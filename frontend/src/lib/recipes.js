import { normalizeCatalogText } from "../constants/pantryCatalog";

// Pure presentation helpers for the recipe views. No React, no Firestore.

const asNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

function recipeTime(recipe) {
  return asNumber(recipe?.time ?? recipe?.time_minutes);
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
