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

// `rows` are the raw seed rows, `manualSynonyms` the alias -> canonical-name map.
// `warn` is where an unresolvable synonym is reported; a synonym whose target no
// longer exists used to be skipped in silence, which is exactly what happens
// when an item gets renamed, so it has to be loud.
function buildPantryCatalog(rows, manualSynonyms = {}, warn = console.warn) {
  const categoryOrder = [];
  const categoryIndex = new Map();
  const catalogByKey = new Map();
  const aliasToEntry = new Map();

  function ensureCategory(category) {
    if (categoryIndex.has(category)) return;
    categoryIndex.set(category, categoryOrder.length);
    categoryOrder.push(category);
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

  return { categoryOrder, catalogByKey, aliasToEntry };
}

module.exports = {
  PRIORITY_RANK,
  buildPantryCatalog,
  collectAliases,
  normalizeCategory,
  readPurchase,
};
