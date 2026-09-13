import { normalizeCatalogText } from "./catalogText";
import { ingredientNameCandidates } from "../lib/ingredientText";
import {
  buildSuggestionIndex,
  searchSuggestions,
} from "../lib/catalogSearch";

const UNKNOWN_CATEGORY = "Egyéb";



// The API omits `purchase` for items with no package data; guard the shape here
// so every catalog entry exposes either a usable { unit, amount } or null.
function normalizePurchase(purchase) {
  const unit = (purchase?.unit || "").toString().trim();
  const amount = Number(purchase?.amount);
  if (!unit || !Number.isFinite(amount) || amount <= 0) return null;
  return { unit, amount };
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
          imageUrl: item.imageUrl || null,
          // Smallest purchasable package ({ unit, amount }), or null where the
          // catalog has no data for it — see accumulatePurchase in lib/units.
          purchase: normalizePurchase(item.purchase),
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

  // Typeahead rows for the add-item field: every item under its own key plus one
  // per alias, built once here because the keys only change with the payload.
  // The query is the only moving part, so the search itself stays a scan.
  const SUGGESTION_INDEX = buildSuggestionIndex(CATALOG_ITEMS, aliasToEntry);

  function searchCatalog(query, limit) {
    return searchSuggestions(SUGGESTION_INDEX, query, limit);
  }

  // Every lookup key that points at an item -- the items' own keys and their
  // aliases -- split into tokens, for the two fuzzy levels below.
  const TOKENIZED_KEYS = [
    ...Array.from(catalogByKey.values(), (entry) => [entry.key, entry]),
    ...Array.from(aliasToEntry, ([key, entry]) => [key, entry]),
  ].map(([key, entry]) => ({ tokens: key.split(" ").filter(Boolean), entry }));

  // Level 3: the input names *less* than a catalog item does -- {bors} inside
  // {fekete, bors}. Safe in this direction only.
  //
  // The reverse ({vanilias, cukor} containing {cukor}) is the naive rule that
  // has to be refused: it cannot be told apart from a product qualifier without
  // a second word list, and guessing there is what the plan forbids. Extra words
  // in the input are handled by the allowlist cleaner instead.
  //
  // Ambiguity is refused rather than guessed: {sajt} sits inside both
  // "Manchego sajt" and "sajt (trappista / felkemeny)", and picking one for the
  // user is worse than leaving the row in "Egyeb".
  function bySubsetOfTokens(tokens) {
    const wanted = new Set(tokens);
    let best = null;
    let bestExtra = Infinity;
    let ambiguous = false;

    for (const { tokens: candidate, entry } of TOKENIZED_KEYS) {
      if (candidate.length <= tokens.length) continue;
      if (!tokens.every((token) => candidate.includes(token))) continue;

      const extra = candidate.filter((token) => !wanted.has(token)).length;
      if (extra < bestExtra) {
        best = entry;
        bestExtra = extra;
        ambiguous = false;
      } else if (extra === bestExtra && entry.key !== best?.key) {
        ambiguous = true;
      }
    }

    return ambiguous ? null : best;
  }

  // Level 4: the input starts with a catalog item and trails off -- "tejszin
  // (30%-os)" -> "tejszin". Matching a *prefix* is what makes this safe in
  // Hungarian: a qualifier comes before the noun ("vanilias cukor", "teljes
  // kiorlesu liszt"), so it can never be the part that gets dropped. Only
  // trailing detail is, and that is where the specs live.
  function byTokenPrefix(tokens) {
    let best = null;
    for (const { tokens: candidate, entry } of TOKENIZED_KEYS) {
      if (!candidate.length || candidate.length >= tokens.length) continue;
      if (best && candidate.length <= best.tokens.length) continue;
      if (candidate.every((token, i) => token === tokens[i])) {
        best = { tokens: candidate, entry };
      }
    }
    return best?.entry || null;
  }

  // The resolution ladder -- the first level that hits wins. Levels 1 and 2 are
  // exact lookups (the name as given, then the cleaned spellings); 3 and 4 are
  // the deterministic fuzzy ones. A typo level (Levenshtein) deliberately does
  // not exist: a guess must never be applied on the user's behalf.
  // Grouping the two lists re-resolves every row on every render, and a row that
  // resolves at neither exact level pays for two scans of the whole key set. The
  // cache lives with this catalog instance, so a new catalog payload drops it.
  const resolved = new Map();

  function resolveEntry(name) {
    if (resolved.has(name)) return resolved.get(name);
    const hit = resolveEntryUncached(name);
    resolved.set(name, hit);
    return hit;
  }

  function resolveEntryUncached(name) {
    const candidates = ingredientNameCandidates(name);

    for (const candidate of candidates) {
      const key = normalizeCatalogText(candidate);
      if (!key) continue;
      const hit = aliasToEntry.get(key) || catalogByKey.get(key);
      if (hit) return hit;
    }

    for (const candidate of candidates) {
      const tokens = normalizeCatalogText(candidate).split(" ").filter(Boolean);
      if (!tokens.length) continue;
      const hit = bySubsetOfTokens(tokens) || byTokenPrefix(tokens);
      if (hit) return hit;
    }

    return null;
  }

  function resolveCatalogKey(name) {
    const key = normalizeCatalogText(name);
    if (!key) return "";
    // An unresolved name keeps its own key: it must not merge with anything, and
    // it must read back the way it was typed.
    return resolveEntry(name)?.key || key;
  }

  function resolveCanonicalCatalogName(name) {
    if (!normalizeCatalogText(name)) return "";
    return resolveEntry(name)?.name || (name || "").toString().trim();
  }

  function getCatalogItemByName(name) {
    if (!normalizeCatalogText(name)) return null;
    return resolveEntry(name);
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
        imageUrl: meta?.imageUrl || null,
        purchase: meta?.purchase || null,
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
    searchCatalog,
    resolveCatalogKey,
    resolveCanonicalCatalogName,
    getCatalogItemByName,
    groupItemsByCatalog,
    getMissingCatalogRecommendations,
  };
}
