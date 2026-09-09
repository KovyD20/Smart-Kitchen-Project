// Normalizes a catalog name or alias to its lookup key. This is a COPY of
// backend/lib/normalize.js — the seed writes the keys, this reads them, and the
// two workspaces cannot import from each other. A one-character drift breaks
// every alias silently, so both sides are pinned by
// shared/normalizeCatalogText.cases.json, which both test suites walk.
//
// It lives in a module of its own so that the input cleaner (lib/ingredientText)
// can use it without importing the catalog it is itself part of.
export function normalizeCatalogText(value) {
  const base = (value || "").toString().trim().toLocaleLowerCase("hu-HU");
  if (!base) return "";

  const ascii = base.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ascii
    .replace(/[()]/g, " ")
    .replace(/[\\/]/g, " ")
    .replace(/[-_,.;:!+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
