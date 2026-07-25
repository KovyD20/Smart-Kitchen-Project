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
