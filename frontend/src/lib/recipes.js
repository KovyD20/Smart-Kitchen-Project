import { normalizeCatalogText } from "../constants/pantryCatalog";

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
