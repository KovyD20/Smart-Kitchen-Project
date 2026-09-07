const express = require("express");
const { z } = require("zod");
const { requireAuth } = require("../middleware/auth");
const { aiLimiter } = require("../middleware/rateLimit");
const { validate } = require("../middleware/validate");
const { generateJson } = require("../lib/aiClient");
const {
  RECIPE_SCHEMA,
  FRIDGE_RECIPE_SCHEMA,
  URL_RECIPE_SCHEMA,
  OPTIONS_SCHEMA,
  SYSTEM_PROMPT,
} = require("../lib/aiSchemas");
const { fetchPageHtml } = require("../lib/recipeUrl");
const { htmlToText } = require("../lib/htmlText");
const { extractRecipe, recipeToText } = require("../lib/recipeJsonLd");

const router = express.Router();

// All AI endpoints require an authenticated user, then are rate-limited per user.
router.use(requireAuth);
router.use(aiLimiter);

const itemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  amount: z.union([z.number(), z.string()]).optional(),
  unit: z.string().max(40).optional(),
});

const recipeByNameSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const suggestFromFridgeSchema = z.object({
  items: z.array(itemSchema).min(1),
});

// The length cap is the point: a 2000-character URL is not a recipe link, and the
// value goes straight into a server-side fetch.
const recipeFromUrlSchema = z.object({
  url: z.string().trim().min(1).max(2000).url(),
});

const recipeFromFridgeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  items: z.array(itemSchema).min(1),
});

function describeItems(items) {
  return items
    .map((item) => `${item.name} (${item.amount ?? ""} ${item.unit ?? ""})`.trim())
    .join(", ");
}

// Every endpoint fails the same way, and the shape of that failure is part of the
// contract with the frontend: `code` selects the Hungarian wording there.
function sendAiError(res, err, endpoint) {
  console.error(`AI error ${endpoint}:`, err.raw || err.message);
  const payload = { error: err.message || "AI generation failed" };
  if (err.code) payload.code = err.code;
  if (err.raw) payload.raw = err.raw;
  if (err.retryAfterSeconds) {
    payload.retry_after_seconds = err.retryAfterSeconds;
  }
  res.status(err.status || 500).json(payload);
}

router.post("/recipe-by-name", validate(recipeByNameSchema), async (req, res) => {
  const { name } = req.body;

  try {
    const recipe = await generateJson({
      system: SYSTEM_PROMPT,
      prompt: `Készíts receptet az alábbi ételnév alapján: "${name}"`,
      schema: RECIPE_SCHEMA,
    });
    res.json({ recipe });
  } catch (err) {
    sendAiError(res, err, "/recipe-by-name");
  }
});

router.post("/suggest-from-fridge", validate(suggestFromFridgeSchema), async (req, res) => {
  const prompt = [
    "Az alábbi elérhető hozzávalók alapján adj 5-8 lehetséges, magyar nevű ételt.",
    `Hozzávalók: ${describeItems(req.body.items)}`,
  ].join("\n");

  try {
    const data = await generateJson({
      system: SYSTEM_PROMPT,
      prompt,
      schema: OPTIONS_SCHEMA,
    });
    res.json({ options: data.options || [] });
  } catch (err) {
    sendAiError(res, err, "/suggest-from-fridge");
  }
});

router.post("/recipe-from-fridge", validate(recipeFromFridgeSchema), async (req, res) => {
  const { name } = req.body;

  const prompt = [
    "Készíts receptet a megadott ételnévhez KIZÁRÓLAG a listázott hozzávalókból.",
    "Ne adj hozzá olyan hozzávalót, ami nincs a listában.",
    'Ha az étel nem készíthető el a listából, a "feasible" mező legyen false, a servings és a time_minutes 0, az ingredients és a steps pedig üres lista.',
    `Étel neve: "${name}"`,
    `Elérhető hozzávalók: ${describeItems(req.body.items)}`,
  ].join("\n");

  try {
    const { feasible, ...recipe } = await generateJson({
      system: SYSTEM_PROMPT,
      prompt,
      schema: FRIDGE_RECIPE_SCHEMA,
    });
    if (!feasible) {
      return res.status(422).json({
        error: "Recipe not possible from these ingredients",
        code: "AI_NOT_FEASIBLE",
      });
    }
    res.json({ recipe });
  } catch (err) {
    sendAiError(res, err, "/recipe-from-fridge");
  }
});

router.post("/recipe-from-url", validate(recipeFromUrlSchema), async (req, res) => {
  const { url } = req.body;

  let html;
  try {
    html = await fetchPageHtml(url);
  } catch (err) {
    // Already carries a status and a code from lib/recipeUrl.
    return sendAiError(res, err, "/recipe-from-url");
  }

  // Prefer the page's own schema.org/Recipe block: labelled fields beat guessing
  // from a page that is mostly navigation. Falls back to the whole page as text.
  const structured = extractRecipe(html);
  const source = structured ? "jsonld" : "text";
  const pageText = structured ? recipeToText(structured) : htmlToText(html);

  // A page that reduces to almost nothing is a JS-rendered site or a bot wall.
  // Sending it to the model would only buy a confidently invented recipe. The
  // structured path is exempt: a short ingredient list is still a real recipe.
  if (!structured && pageText.length < 200) {
    return res.status(422).json({
      error: "No readable recipe text on that page",
      code: "URL_NO_TEXT",
    });
  }

  const intro = structured
    ? [
        "Az alábbi recept egy weboldal strukturált adatából (schema.org) származik.",
        "A mezők megbízhatóak: a nevet, az adagszámot és az időt vedd át úgy, ahogy van.",
        "A hozzávalók szabad szövegként érkeztek — ezeket bontsd szét name/amount/unit mezőkre.",
      ]
    : [
        "Az alábbi szöveg egy weboldalról származó recept nyers kivonata.",
        "Írd át a saját formánkba: csak azt használd fel, ami a szövegben szerepel.",
      ];

  const prompt = [
    ...intro,
    "Ne találj ki hozzávalót, mennyiséget vagy lépést, amit a szöveg nem tartalmaz.",
    "Ha a szövegben nincs valódi recept (pl. kategórialista, hibaoldal, robotellenőrzés),",
    'a "found" mező legyen false, a servings és a time_minutes 0, az ingredients és a steps pedig üres lista.',
    "A lépéseket bontsd külön mondatokra a steps listában, a sorszámozást hagyd el.",
    "",
    structured ? "A recept adatai:" : "Az oldal szövege:",
    pageText,
  ].join("\n");

  try {
    const { found, ...recipe } = await generateJson({
      system: SYSTEM_PROMPT,
      prompt,
      schema: URL_RECIPE_SCHEMA,
      // A full recipe plus a long page is more than the default budget: cutting
      // off mid-object surfaces as AI_INVALID_JSON, which reads like a bug.
      maxTokens: 6144,
    });
    if (!found) {
      return res.status(422).json({
        error: "No recipe found at that URL",
        code: "URL_NO_RECIPE",
      });
    }
    // `source` is for us, not the UI: it says which path produced this, which is
    // the first thing worth knowing when an import comes back wrong.
    res.json({ recipe, sourceUrl: url, source });
  } catch (err) {
    sendAiError(res, err, "/recipe-from-url");
  }
});

module.exports = router;
