import { normalizeCatalogText } from "../constants/pantryCatalog";
import { MAIN_TAG_NAMES, mainTagOf } from "../constants/recipeTags";

// Pure presentation helpers for the recipe views. No React, no Firestore.

const asNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

function recipeTime(recipe) {
  return asNumber(recipe?.time ?? recipe?.time_minutes);
}

// "90 perc", or null when the recipe does not say. Exposed on its own so a card
// can put the ingredient count in a separately styled badge and still append the
// time in the same line.
export function recipeTimeLabel(recipe) {
  const minutes = recipeTime(recipe);
  return minutes ? `${minutes} perc` : null;
}

export function recipeServings(recipe) {
  return asNumber(recipe?.servings) || 1;
}

// "12 hozzávaló · 90 perc" — the card/header subtitle used all over the design.
export function recipeMeta(recipe) {
  const parts = [`${recipe?.ingredients?.length || 0} hozzávaló`];
  const minutes = recipeTime(recipe);
  if (minutes) parts.push(`${minutes} perc`);
  return parts.join(" · ");
}

export function formatAmount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return Number(parsed.toFixed(2)).toString();
}

// Ingredient amounts scale linearly with the serving count.
export function scaleIngredients(ingredients, servings, baseServings) {
  return (ingredients || []).map((ingredient) => {
    const amount = Number(ingredient?.amount);
    if (!Number.isFinite(amount)) return ingredient;
    return {
      ...ingredient,
      amount: formatAmount((amount * servings) / (baseServings || 1)),
    };
  });
}

// Splits a recipe's ingredients into "already in the fridge" and "still missing",
// comparing on catalog keys so accents/aliases/units don't cause false misses.
export function splitByFridge(ingredients, fridge, keyOf) {
  const fridgeKeys = new Set(
    (fridge || []).map((item) => keyOf(item?.name)).filter(Boolean),
  );

  const have = [];
  const missing = [];

  for (const ingredient of ingredients || []) {
    const key = keyOf(ingredient?.name);
    (key && fridgeKeys.has(key) ? have : missing).push(ingredient);
  }

  return { have, missing };
}

// "5/8 hozzávaló megvan" -- the recipe card's badge and the basis for the
// "Ami megvan" ordering.
export function recipeAvailability(recipe, fridge, keyOf) {
  const total = recipe?.ingredients?.length || 0;
  if (total === 0) return { have: 0, total: 0, ratio: 0 };
  const { have } = splitByFridge(recipe.ingredients, fridge, keyOf);
  return { have: have.length, total, ratio: have.length / total };
}

// Drives the badge colour: everything in the fridge, some of it, or none.
export function availabilityLevel(availability) {
  const { have = 0, total = 0 } = availability || {};
  if (total > 0 && have >= total) return "full";
  if (have > 0) return "partial";
  return "empty";
}

// Orders recipes by how much of them is already in the fridge.
//
// The ratio leads, not the raw count: with the raw count a 20-ingredient recipe
// missing 14 items would outrank a 3-ingredient one that is ready to cook. Ties
// go to whichever needs fewer extra ingredients, then to Hungarian collation so
// the order is stable and reads naturally.
export function sortByAvailability(recipes, fridge, keyOf) {
  return (recipes || [])
    // Availability is computed once per recipe rather than inside the comparator,
    // which would recompute it O(n log n) times.
    .map((recipe) => ({
      recipe,
      availability: recipeAvailability(recipe, fridge, keyOf),
    }))
    .sort((a, b) => {
      if (b.availability.ratio !== a.availability.ratio) {
        return b.availability.ratio - a.availability.ratio;
      }
      const missingA = a.availability.total - a.availability.have;
      const missingB = b.availability.total - b.availability.have;
      if (missingA !== missingB) return missingA - missingB;
      return (a.recipe?.name || "").localeCompare(
        b.recipe?.name || "",
        "hu-HU",
      );
    })
    .map((entry) => entry.recipe);
}

// Orders recipes by their course, in the fixed MAIN_TAGS order (which is roughly
// the order of a meal: Reggeli, Leves, Főétel, Desszert, Egyéb) and then by name
// inside each course. Recipes saved before courses became mandatory have none, so
// they collect at the end rather than being guessed into a category.
export function sortByCourse(recipes) {
  const rank = (recipe) => {
    const course = mainTagOf(recipe);
    if (!course) return MAIN_TAG_NAMES.length;
    const index = MAIN_TAG_NAMES.indexOf(course);
    // mainTagOf matches case-insensitively, so a recipe carrying "leves" is a
    // course even though indexOf on the canonical list would miss it.
    return index === -1 ? MAIN_TAG_NAMES.length : index;
  };

  return [...(recipes || [])].sort((a, b) => {
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return (a?.name || "").localeCompare(b?.name || "", "hu-HU");
  });
}

// Reserved filter id for the favourites chip. Favourites are a system flag on the
// recipe, not one of the user's tags -- tags can be renamed and deleted globally
// (deleteTagGlobally), which must never take the favourite state with them.
export const FAVORITES_FILTER = "favorites";

// The "Receptek" tab's filter chain: the tag/favourites chip plus the header
// search. Extracted from Home.jsx so the branching is unit-testable.
export function filterRecipes(recipes, { filterTag = "all", search = "" } = {}) {
  return (recipes || []).filter((recipe) => {
    if (!recipeMatchesSearch(recipe, search)) return false;
    if (filterTag === "all") return true;
    if (filterTag === FAVORITES_FILTER) return recipe?.favorite === true;
    return recipe?.tags?.includes(filterTag) === true;
  });
}

// Header search: matches a recipe on its name, tags or ingredient names.
// Comparison runs on the catalog's normalized text (lowercase, accent-free), so
// "turos" finds "Túrós csusza".
export function recipeMatchesSearch(recipe, term) {
  const needle = normalizeCatalogText(term);
  if (!needle) return true;

  if (normalizeCatalogText(recipe?.name).includes(needle)) return true;
  if (
    (recipe?.tags || []).some((tag) =>
      normalizeCatalogText(tag).includes(needle),
    )
  )
    return true;
  return (recipe?.ingredients || []).some((ing) =>
    normalizeCatalogText(ing?.name).includes(needle),
  );
}

// Same matching rule for the flat shopping-list / fridge item names.
export function itemMatchesSearch(item, term) {
  const needle = normalizeCatalogText(term);
  if (!needle) return true;
  return normalizeCatalogText(item?.displayName || item?.name).includes(needle);
}

// Ingredients can carry an optional `group` ("A töltelékhez"), which sections the
// list the way a cookbook does. Runs of consecutive same-group items are folded
// into one block; the order is NOT rearranged, because the recipe's own order is
// itself information -- the same group appearing twice, apart, stays two blocks.
// Ungrouped items land in a block with `group: null`, which renders without a
// heading rather than under an invented "Egyéb".
export function groupIngredients(ingredients) {
  const blocks = [];

  for (const ingredient of ingredients || []) {
    const group = ingredient?.group?.trim() || null;
    const last = blocks[blocks.length - 1];
    if (last && last.group === group) last.items.push(ingredient);
    else blocks.push({ group, items: [ingredient] });
  }

  return blocks;
}

// `group` and `note` are optional, so an ingredient that has neither must not
// carry two empty strings into Firestore -- every reader would then have to
// treat "" and undefined alike. The AI can return empty strings for both, and
// so can a form row whose fields were opened and left blank.
export function cleanIngredient({ group, note, ...ingredient }) {
  return {
    ...ingredient,
    ...(group?.trim() ? { group: group.trim() } : {}),
    ...(note?.trim() ? { note: note.trim() } : {}),
  };
}
