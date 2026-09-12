// Turns the flat seed rows into the catalog the seeder writes: categories in
// first-seen order, canonical items with priority tie-breaking, and the alias
// index.
//
// This lives in lib/ rather than in scripts/seedPantry.js so it can be tested:
// the seeder imports db/pool, which throws without a .env, and CI has none. It
// takes the rows as arguments instead of importing the seed data, so the same
// builder can be run against a fixture.
const { normalizeCatalogText } = require("./normalize");

// A row's `priority` is a stock level, not a colour. When two rows or two
// aliases collide, the higher stock level wins.
const PRIORITY_RANK = {
  extra: 1,
  good_to_have: 2,
  essential: 3,
};

function normalizeCategory(value) {
  return (value || "")
    .toString()
    .trim()
    .replace(/^\d+\.\s*/, "")
    .trim();
}

// Every spelling of a row that should resolve to it: the name itself, the name
// without its parenthesised part, the slash-separated alternatives, and the
// hand-written `aliases` of the row.
//
// The hand-written ones are taken literally (normalized, but not split or
// stripped further). Deriving from a derived form is how an alias ends up
// pointing at something nobody chose — if a variant is wanted, it is written out
// in the seed data.
function collectAliases(row) {
  const source = (row?.name || "").toString().trim();
  if (!source) return [];

  const aliases = new Set([source]);
  const withoutParentheses = source.replace(/\([^)]*\)/g, "").trim();
  if (withoutParentheses) {
    aliases.add(withoutParentheses);
  }

  source
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => aliases.add(part));

  const groupMatches = source.match(/\(([^)]+)\)/);
  if (groupMatches && groupMatches[1]) {
    groupMatches[1]
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => aliases.add(part));
  }

  for (const alias of row?.aliases || []) {
    const trimmed = (alias || "").toString().trim();
    if (trimmed) aliases.add(trimmed);
  }

  return Array.from(aliases);
}

// Package size ("1 kg", "10 db") for the shopping list's rounding. Both fields
// are optional and only usable together, so a half-filled row is dropped rather
// than stored as a unit with no amount.
function readPurchase(row) {
  const unit = (row.purchaseUnit || "").toString().trim();
  const amount = Number(row.purchaseAmount);
  if (!unit || !Number.isFinite(amount) || amount <= 0) return null;
  return { unit, amount };
}

// Puts the categories in the order the shop is walked.
//
// `declared` is the seed's CATEGORY_ORDER; without one the categories keep the
// order they were first seen in, which is all a fixture needs. Both sides are
// normalized, so a declared name may carry the same "9. " prefix the rows do.
//
// A mismatch is reported rather than ignored: a category that the rows use but
// the list forgets would otherwise slide to the end in silence, and nobody finds
// that out until they are standing in the shop with the aisles in the wrong
// order. Unlisted categories keep their first-seen order, after the listed ones.
function orderCategories(seen, declared, warn) {
  if (!declared) return seen;

  const rank = new Map(declared.map((name, index) => [normalizeCategory(name), index]));
  const LAST = Number.MAX_SAFE_INTEGER;

  const unlisted = seen.filter((name) => !rank.has(name));
  if (unlisted.length) {
    warn(
      `buildPantryCatalog: ${unlisted
        .map((name) => `"${name}"`)
        .join(", ")} missing from CATEGORY_ORDER — put at the end.`,
    );
  }

  const unused = [...rank.keys()].filter((name) => !seen.includes(name));
  if (unused.length) {
    warn(
      `buildPantryCatalog: CATEGORY_ORDER lists ${unused
        .map((name) => `"${name}"`)
        .join(", ")}, which no row uses.`,
    );
  }

  return [...seen].sort(
    (a, b) =>
      (rank.get(a) ?? LAST) - (rank.get(b) ?? LAST) ||
      seen.indexOf(a) - seen.indexOf(b),
  );
}

// `rows` are the raw seed rows, `manualSynonyms` the alias -> canonical-name map.
//
// Options:
//   warn           where an unresolvable synonym or a category-order mismatch is
//                  reported; a synonym whose target no longer exists used to be
//                  skipped in silence, which is exactly what happens when an item
//                  gets renamed, so it has to be loud.
//   categoryOrder  the display order of the categories (see orderCategories).
function buildPantryCatalog(
  rows,
  manualSynonyms = {},
  { warn = console.warn, categoryOrder = null } = {},
) {
  const seenOrder = [];
  const categoryIndex = new Map();
  const catalogByKey = new Map();
  const aliasToEntry = new Map();

  function ensureCategory(category) {
    if (categoryIndex.has(category)) return;
    categoryIndex.set(category, seenOrder.length);
    seenOrder.push(category);
  }

  for (const row of rows) {
    const category = normalizeCategory(row.category);
    ensureCategory(category);

    const key = normalizeCatalogText(row.name);
    if (!key) continue;

    const priority = row.priority || "extra";
    const purchase = readPurchase(row);
    const existing = catalogByKey.get(key);
    if (!existing) {
      catalogByKey.set(key, {
        key,
        name: row.name,
        category,
        priority,
        purchase,
      });
      continue;
    }

    const incomingRank = PRIORITY_RANK[priority] || 0;
    const existingRank = PRIORITY_RANK[existing.priority] || 0;
    if (incomingRank > existingRank) {
      existing.priority = priority;
    }
    // Duplicate names are merged; the first row that carries package data wins.
    if (!existing.purchase && purchase) {
      existing.purchase = purchase;
    }
  }

  function registerAlias(alias, entry) {
    const aliasKey = normalizeCatalogText(alias);
    if (!aliasKey || !entry) return;

    const existing = aliasToEntry.get(aliasKey);
    if (!existing) {
      aliasToEntry.set(aliasKey, entry);
      return;
    }

    const existingRank = PRIORITY_RANK[existing.priority] || 0;
    const incomingRank = PRIORITY_RANK[entry.priority] || 0;
    if (incomingRank > existingRank) {
      aliasToEntry.set(aliasKey, entry);
    }
  }

  for (const row of rows) {
    const entry = catalogByKey.get(normalizeCatalogText(row.name));
    if (!entry) continue;
    collectAliases(row).forEach((alias) => registerAlias(alias, entry));
  }

  for (const [alias, canonical] of Object.entries(manualSynonyms)) {
    const targetKey = normalizeCatalogText(canonical);
    const targetEntry =
      aliasToEntry.get(targetKey) || catalogByKey.get(targetKey) || null;
    if (!targetEntry) {
      warn(
        `buildPantryCatalog: the synonym "${alias}" points at "${canonical}", which is not in the catalog — skipping it.`,
      );
      continue;
    }
    registerAlias(alias, targetEntry);
  }

  return {
    categoryOrder: orderCategories(seenOrder, categoryOrder, warn),
    catalogByKey,
    aliasToEntry,
  };
}

module.exports = {
  PRIORITY_RANK,
  buildPantryCatalog,
  orderCategories,
  collectAliases,
  normalizeCategory,
  readPurchase,
};
