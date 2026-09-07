// Reads a schema.org/Recipe out of a page's JSON-LD, when it has one.
//
// Most Hungarian recipe sites publish this block (it is what puts the recipe card
// into Google's results), and it beats the raw-text fallback on every axis: the
// name, servings, time, ingredient lines and steps come out *labelled*, instead of
// being inferred from a page that is 90% navigation, comments and ads. A 300kB
// page becomes ~1kB of actual recipe, so the model gets less to hallucinate from,
// answers faster, and costs less.
//
// This does not replace the model. schema.org ingredient lines are free text --
// "2 nagy fej vöröshagyma" -- and our format needs {name, amount, unit} with a
// unit from a fixed enum. Splitting that is still the model's job; what changes is
// that it works from clean input.
const { htmlToText, fieldToText, MAX_TEXT_CHARS } = require("./htmlText");

// Pages carry several JSON-LD blocks (organization, breadcrumbs, article, recipe)
// and a deeply nested @graph is common, so cap the walk rather than trusting the
// document's shape.
const MAX_JSON_LD_BYTES = 512 * 1024;
const MAX_DEPTH = 12;

function isRecipeNode(node) {
  if (!node || typeof node !== "object") return false;
  const type = node["@type"];
  if (typeof type === "string") return type.toLowerCase() === "recipe";
  if (Array.isArray(type)) {
    return type.some((t) => typeof t === "string" && t.toLowerCase() === "recipe");
  }
  return false;
}

// Depth-first through arrays, @graph, and any nested object -- a Recipe is often
// buried under mainEntity or itemListElement.
function findRecipeNode(value, depth = 0) {
  if (depth > MAX_DEPTH || !value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRecipeNode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (isRecipeNode(value)) return value;

  for (const child of Object.values(value)) {
    if (child && typeof child === "object") {
      const found = findRecipeNode(child, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

// ISO 8601 duration -> minutes. "PT1H30M" is the common form; days appear on slow
// recipes (rising dough, marinades). Only the time part is read: an `M` before the
// `T` means months, not minutes, and no recipe means that.
function parseIsoDuration(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== "string") return null;

  const match = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?)?/i.exec(
    value.trim(),
  );
  if (!match) return null;

  const [, days, hours, minutes] = match;
  const total =
    Number(days || 0) * 24 * 60 + Number(hours || 0) * 60 + Number(minutes || 0);
  return total > 0 ? Math.round(total) : null;
}

// `recipeYield` is any of 4, "4", "4 adag", "4 servings", ["4 adag"], or
// {"@type": "QuantitativeValue", "value": 4}.
function parseYield(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = parseYield(item);
      if (parsed) return parsed;
    }
    return null;
  }
  if (typeof value === "object") return parseYield(value.value ?? value.name);
  if (typeof value !== "string") return null;

  const number = /(\d+(?:[.,]\d+)?)/.exec(value);
  if (!number) return null;
  const parsed = Math.round(Number(number[1].replace(",", ".")));
  return parsed > 0 ? parsed : null;
}

function toTextList(value, depth = 0) {
  if (depth > MAX_DEPTH || value == null) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => toTextList(item, depth + 1));
  }

  if (typeof value === "object") {
    // HowToSection groups steps under itemListElement; HowToStep carries `text`.
    if (value.itemListElement) return toTextList(value.itemListElement, depth + 1);
    return toTextList(value.text ?? value.name ?? value.description, depth + 1);
  }

  if (typeof value !== "string") return [];

  // A single string may hold the whole method, one <p> or one line per step --
  // so split on the line breaks htmlToText produces, *then* flatten each piece.
  // (fieldToText alone would collapse the whole method into one "step".)
  return htmlToText(value)
    .split(/\n+/)
    .map((line) => fieldToText(line))
    .filter(Boolean);
}

// Some sites put the page title into `name`, site suffix and all
// ("Klasszikus gulyásleves | Mindmegette.hu"). A pipe does not occur in a real
// Hungarian dish name, so everything from the first one is the site's own furniture.
function cleanName(value) {
  const name = fieldToText(value).split("|")[0].trim();
  return name || null;
}

// `totalTime` when the page states it; otherwise prep + cook, which many sites
// publish instead of a total.
function totalMinutes(node) {
  const total = parseIsoDuration(node.totalTime);
  if (total) return total;

  const sum =
    (parseIsoDuration(node.prepTime) || 0) + (parseIsoDuration(node.cookTime) || 0);
  return sum > 0 ? sum : null;
}

// The page's recipe as labelled fields, or null when it publishes none -- in
// which case the caller falls back to the raw page text.
function extractRecipe(html) {
  const node = findRecipeNode(parseJsonLdBlocks(html));
  if (!node) return null;

  const name = cleanName(node.name);
  const ingredients = toTextList(node.recipeIngredient ?? node.ingredients);
  const steps = toTextList(node.recipeInstructions);

  // A Recipe node with no ingredients is a stub (a category page's "related
  // recipe" marker, or a paywalled teaser) -- not worth the AI call, and the raw
  // text of such a page is usually better.
  if (!ingredients.length) return null;

  return {
    name,
    servings: parseYield(node.recipeYield),
    timeMinutes: totalMinutes(node),
    ingredients,
    steps,
  };
}

// Every <script type="application/ld+json"> block on the page, parsed. Blocks that
// fail to parse are skipped: a broken analytics block must not cost us the recipe.
function parseJsonLdBlocks(html) {
  const blocks = [];
  const pattern =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;
  let budget = MAX_JSON_LD_BYTES;
  while ((match = pattern.exec(html)) !== null) {
    const raw = match[1].trim().replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
    budget -= raw.length;
    if (budget < 0) break;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Malformed block -- skip it and try the next.
    }
  }
  return blocks;
}

// Renders the extracted recipe as the compact, labelled text the prompt works
// from. Labels are Hungarian to match the prompt around it.
function recipeToText(recipe) {
  const lines = [];
  if (recipe.name) lines.push(`Étel neve: ${recipe.name}`);
  if (recipe.servings) lines.push(`Adagok száma: ${recipe.servings}`);
  if (recipe.timeMinutes) lines.push(`Elkészítési idő: ${recipe.timeMinutes} perc`);

  lines.push("", "Hozzávalók:");
  for (const ingredient of recipe.ingredients) lines.push(`- ${ingredient}`);

  if (recipe.steps.length) {
    lines.push("", "Elkészítés:");
    recipe.steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
  }

  return lines.join("\n").slice(0, MAX_TEXT_CHARS);
}

module.exports = {
  extractRecipe,
  recipeToText,
  parseIsoDuration,
  parseYield,
  parseJsonLdBlocks,
};
