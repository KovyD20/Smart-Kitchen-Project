// Normalizes a catalog name or alias to its lookup key. This function exists
// TWICE — here and in frontend/src/constants/pantryCatalog.js — because the two
// workspaces cannot import from each other, and the seed writes the keys the
// browser looks up. The two must stay identical: a one-character drift breaks
// every alias built from the drifted rule, silently and with no error anywhere.
//
// Both sides are pinned by shared/normalizeCatalogText.cases.json, which both
// test suites walk. Change the rule here and the frontend test fails, and the
// other way round.
function normalizeCatalogText(value) {
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

module.exports = { normalizeCatalogText };
