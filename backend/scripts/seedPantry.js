
require("dotenv").config();
const pool = require("../db/pool");
const { normalizeCatalogText } = require("../lib/normalize");
const {
  PRIORITY_RANK,
  RAW_CATALOG_ROWS,
  MANUAL_SYNONYMS,
} = require("./pantrySeedData");

function normalizeCategory(value) {
  return (value || "")
    .toString()
    .trim()
    .replace(/^\d+\.\s*/, "")
    .trim();
}

function collectAliases(name) {
  const source = (name || "").toString().trim();
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

  return Array.from(aliases);
}

// Build the in-memory catalog (categories in first-seen order, canonical items
// with priority tie-breaking, aliases) exactly as the frontend used to.
function buildCatalog() {
  const categoryOrder = [];
  const categoryIndex = new Map();
  const catalogByKey = new Map();
  const aliasToEntry = new Map();

  function ensureCategory(category) {
    if (categoryIndex.has(category)) return;
    categoryIndex.set(category, categoryOrder.length);
    categoryOrder.push(category);
  }

  for (const row of RAW_CATALOG_ROWS) {
    const category = normalizeCategory(row.category);
    ensureCategory(category);

    const key = normalizeCatalogText(row.name);
    if (!key) continue;

    const priority = row.priority || "extra";
    const existing = catalogByKey.get(key);
    if (!existing) {
      catalogByKey.set(key, { key, name: row.name, category, priority });
      continue;
    }

    const incomingRank = PRIORITY_RANK[priority] || 0;
    const existingRank = PRIORITY_RANK[existing.priority] || 0;
    if (incomingRank > existingRank) {
      existing.priority = priority;
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

  for (const row of RAW_CATALOG_ROWS) {
    const entry = catalogByKey.get(normalizeCatalogText(row.name));
    if (!entry) continue;
    collectAliases(row.name).forEach((alias) => registerAlias(alias, entry));
  }

  for (const [alias, canonical] of Object.entries(MANUAL_SYNONYMS)) {
    const targetKey = normalizeCatalogText(canonical);
    const targetEntry =
      aliasToEntry.get(targetKey) || catalogByKey.get(targetKey) || null;
    if (targetEntry) {
      registerAlias(alias, targetEntry);
    }
  }

  return { categoryOrder, catalogByKey, aliasToEntry };
}

async function run() {
  const { categoryOrder, catalogByKey, aliasToEntry } = buildCatalog();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "TRUNCATE pantry_aliases, pantry_items, pantry_categories RESTART IDENTITY CASCADE",
    );

    const categoryIdByName = new Map();
    for (let i = 0; i < categoryOrder.length; i++) {
      const name = categoryOrder[i];
      const res = await client.query(
        "INSERT INTO pantry_categories (name, sort_order) VALUES ($1, $2) RETURNING id",
        [name, i],
      );
      categoryIdByName.set(name, res.rows[0].id);
    }

    const itemIdByKey = new Map();
    for (const entry of catalogByKey.values()) {
      const categoryId = categoryIdByName.get(entry.category);
      const res = await client.query(
        "INSERT INTO pantry_items (category_id, canonical_name, normalized_key, priority) VALUES ($1, $2, $3, $4) RETURNING id",
        [categoryId, entry.name, entry.key, entry.priority],
      );
      itemIdByKey.set(entry.key, res.rows[0].id);
    }

    let aliasCount = 0;
    for (const [aliasKey, entry] of aliasToEntry.entries()) {
      // Skip redundant self-aliases: the frontend falls back to the canonical
      // key lookup, so an alias equal to its own item's key adds nothing.
      if (aliasKey === entry.key) continue;
      const itemId = itemIdByKey.get(entry.key);
      if (!itemId) continue;
      await client.query(
        "INSERT INTO pantry_aliases (item_id, normalized_key) VALUES ($1, $2)",
        [itemId, aliasKey],
      );
      aliasCount++;
    }

    await client.query("COMMIT");
    console.log(
      `Seeded pantry catalog: ${categoryOrder.length} categories, ${catalogByKey.size} items, ${aliasCount} aliases.`,
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

run()
  .then(() => pool.end())
  .catch((err) => {
    console.error("Seed failed:", err.message);
    pool.end();
    process.exit(1);
  });
