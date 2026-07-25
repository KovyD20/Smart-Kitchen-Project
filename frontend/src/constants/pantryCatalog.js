const UNKNOWN_CATEGORY = "Egyéb";


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


export function createCatalog(catalogData) {
  const categories = Array.isArray(catalogData?.categories)
    ? catalogData.categories
    : [];

  const categoryIndex = new Map();
  const catalogByKey = new Map();
  const aliasToEntry = new Map();

  categories
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .forEach((category, index) => {
      categoryIndex.set(category.name, index);

      for (const item of category.items || []) {
        const entry = {
          key: item.normalizedKey,
          name: item.canonicalName,
          category: category.name,
          priority: item.priority || null,
        };
        catalogByKey.set(entry.key, entry);
        for (const aliasKey of item.aliases || []) {
          aliasToEntry.set(aliasKey, entry);
        }
      }
    });

  function compareEntries(a, b) {
    const categoryDiff =
      (categoryIndex.get(a.category) ?? Number.MAX_SAFE_INTEGER) -
      (categoryIndex.get(b.category) ?? Number.MAX_SAFE_INTEGER);
    if (categoryDiff !== 0) return categoryDiff;
    return a.name.localeCompare(b.name, "hu-HU", { sensitivity: "base" });
  }

  const CATALOG_ITEMS = Array.from(catalogByKey.values()).sort(compareEntries);

  function resolveCatalogKey(name) {
    const key = normalizeCatalogText(name);
    if (!key) return "";
    return aliasToEntry.get(key)?.key || key;
  }

  function resolveCanonicalCatalogName(name) {
    const key = normalizeCatalogText(name);
    if (!key) return "";
    const match = aliasToEntry.get(key) || catalogByKey.get(key);
    return match ? match.name : (name || "").toString().trim();
  }

  function getCatalogItemByName(name) {
    const key = resolveCatalogKey(name);
    if (!key) return null;
    return catalogByKey.get(key) || null;
  }

  function groupItemsByCatalog(items) {
    if (!Array.isArray(items) || items.length === 0) return [];

    const grouped = new Map();
    for (const item of items) {
      const meta = getCatalogItemByName(item?.name);
      const category = meta?.category || UNKNOWN_CATEGORY;
      const displayName = meta?.name || (item?.name || "").toString().trim();
      const enrichedItem = {
        ...item,
        displayName,
        nameKey: resolveCatalogKey(displayName),
        category,
        priority: meta?.priority || null,
      };

      const list = grouped.get(category) || [];
      list.push(enrichedItem);
      grouped.set(category, list);
    }

    return Array.from(grouped.entries())
      .sort((a, b) => {
        const aIndex = categoryIndex.get(a[0]) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = categoryIndex.get(b[0]) ?? Number.MAX_SAFE_INTEGER;
        if (aIndex !== bIndex) return aIndex - bIndex;
        return a[0].localeCompare(b[0], "hu-HU", { sensitivity: "base" });
      })
      .map(([category, groupItems]) => ({
        category,
        items: groupItems.sort((a, b) =>
          (a.displayName || "").localeCompare(b.displayName || "", "hu-HU", {
            sensitivity: "base",
          }),
        ),
      }));
  }

  function getMissingCatalogRecommendations(fridgeItems, shoppingItems) {
    const present = new Set(
      [...(fridgeItems || []), ...(shoppingItems || [])]
        .map((item) => resolveCatalogKey(item?.name))
        .filter(Boolean),
    );

    const essential = [];
    const goodToHave = [];
    const extra = [];

    for (const item of CATALOG_ITEMS) {
      if (present.has(item.key)) continue;

      if (item.priority === "essential") {
        essential.push(item);
        continue;
      }
      if (item.priority === "good_to_have") {
        goodToHave.push(item);
        continue;
      }
      extra.push(item);
    }

    return { essential, goodToHave, extra };
  }

  return {
    CATALOG_ITEMS,
    resolveCatalogKey,
    resolveCanonicalCatalogName,
    getCatalogItemByName,
    groupItemsByCatalog,
    getMissingCatalogRecommendations,
  };
}
