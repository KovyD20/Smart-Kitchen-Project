
// Seeds the pantry catalog. Two modes, and the DEFAULT IS THE SAFE ONE:
//
//   npm run seed          upsert  - adds and updates rows, deletes nothing
//   npm run seed:reset    reset   - TRUNCATE + full reload (destructive)
//
// The destructive path is behind an explicit `--reset` flag on purpose. A local
// .env may well point at the managed (production) database, and `npm run seed`
// is the command that gets typed from muscle memory — so the muscle-memory path
// must not be the one that wipes the catalog.
//
// What upsert deliberately does NOT do: remove rows that disappeared from the
// seed data. That is what "additive" means. Renaming an alias therefore leaves
// the old alias row behind, still pointing at its item; use --reset when the
// catalog needs to match the seed data exactly.
require("dotenv").config();
const pool = require("../db/pool");
const { migrate } = require("./migrate");
const { parseSeedArgs, describeTarget } = require("../lib/seedOptions");
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

// Package size ("1 kg", "10 db") for the shopping list's rounding. Both fields
// are optional and only usable together, so a half-filled row is dropped rather
// than stored as a unit with no amount.
function readPurchase(row) {
  const unit = (row.purchaseUnit || "").toString().trim();
  const amount = Number(row.purchaseAmount);
  if (!unit || !Number.isFinite(amount) || amount <= 0) return null;
  return { unit, amount };
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

// `xmax = 0` is true only for a row this statement inserted, so one RETURNING
// tells insert and update apart. Worth it here: "3 new, 300 updated" is the
// feedback that says whether a seed edit did what you meant.
const INSERTED = "(xmax = 0) AS inserted";

async function seedCategories(client, categoryOrder, { reset }) {
  const categoryIdByName = new Map();
  for (let i = 0; i < categoryOrder.length; i++) {
    const name = categoryOrder[i];
    const res = reset
      ? await client.query(
          "INSERT INTO pantry_categories (name, sort_order) VALUES ($1, $2) RETURNING id",
          [name, i],
        )
      : await client.query(
          `INSERT INTO pantry_categories (name, sort_order) VALUES ($1, $2)
           ON CONFLICT (name) DO UPDATE SET sort_order = EXCLUDED.sort_order
           RETURNING id`,
          [name, i],
        );
    categoryIdByName.set(name, res.rows[0].id);
  }
  return categoryIdByName;
}

async function seedItems(client, catalogByKey, categoryIdByName, { reset }) {
  const itemIdByKey = new Map();
  let inserted = 0;

  for (const entry of catalogByKey.values()) {
    const params = [
      categoryIdByName.get(entry.category),
      entry.name,
      entry.key,
      entry.priority,
      entry.purchase?.unit ?? null,
      entry.purchase?.amount ?? null,
    ];

    // image_url is intentionally absent from both the column list and the UPDATE
    // set: it is an operator-set override (a CDN or uploaded URL), not seed data,
    // so an upsert must leave whatever is already there alone.
    const res = reset
      ? await client.query(
          `INSERT INTO pantry_items
             (category_id, canonical_name, normalized_key, priority, purchase_unit, purchase_amount)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, ${INSERTED}`,
          params,
        )
      : await client.query(
          `INSERT INTO pantry_items
             (category_id, canonical_name, normalized_key, priority, purchase_unit, purchase_amount)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (normalized_key) DO UPDATE SET
             category_id     = EXCLUDED.category_id,
             canonical_name  = EXCLUDED.canonical_name,
             priority        = EXCLUDED.priority,
             purchase_unit   = EXCLUDED.purchase_unit,
             purchase_amount = EXCLUDED.purchase_amount
           RETURNING id, ${INSERTED}`,
          params,
        );

    itemIdByKey.set(entry.key, res.rows[0].id);
    if (res.rows[0].inserted) inserted++;
  }

  return { itemIdByKey, inserted };
}

async function seedAliases(client, aliasToEntry, itemIdByKey, { reset }) {
  let total = 0;
  let inserted = 0;

  for (const [aliasKey, entry] of aliasToEntry.entries()) {
    // Skip redundant self-aliases: the frontend falls back to the canonical
    // key lookup, so an alias equal to its own item's key adds nothing.
    if (aliasKey === entry.key) continue;
    const itemId = itemIdByKey.get(entry.key);
    if (!itemId) continue;

    // On re-point (an alias that moved to another item) the UPDATE is what keeps
    // the unique normalized_key from aborting the whole seed.
    const res = reset
      ? await client.query(
          `INSERT INTO pantry_aliases (item_id, normalized_key) VALUES ($1, $2)
           RETURNING ${INSERTED}`,
          [itemId, aliasKey],
        )
      : await client.query(
          `INSERT INTO pantry_aliases (item_id, normalized_key) VALUES ($1, $2)
           ON CONFLICT (normalized_key) DO UPDATE SET item_id = EXCLUDED.item_id
           RETURNING ${INSERTED}`,
          [itemId, aliasKey],
        );

    total++;
    if (res.rows[0].inserted) inserted++;
  }

  return { total, inserted };
}

async function run() {
  const { reset } = parseSeedArgs(process.argv.slice(2));
  const { categoryOrder, catalogByKey, aliasToEntry } = buildCatalog();

  console.log(
    `Seeding pantry catalog -> ${describeTarget()}  [${reset ? "RESET: truncate + reload" : "upsert: additive"}]`,
  );

  // The writes below need the tables to exist. Applying the (idempotent) schema
  // first makes seeding work against a fresh managed database too, not just one
  // bootstrapped by the Docker entrypoint.
  await migrate();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (reset) {
      await client.query(
        "TRUNCATE pantry_aliases, pantry_items, pantry_categories RESTART IDENTITY CASCADE",
      );
    }

    const categoryIdByName = await seedCategories(client, categoryOrder, {
      reset,
    });
    const items = await seedItems(client, catalogByKey, categoryIdByName, {
      reset,
    });
    const aliases = await seedAliases(client, aliasToEntry, items.itemIdByKey, {
      reset,
    });

    await client.query("COMMIT");

    const withPurchase = Array.from(catalogByKey.values()).filter(
      (entry) => entry.purchase,
    ).length;
    const counts = reset
      ? `${catalogByKey.size} items, ${aliases.total} aliases`
      : `${catalogByKey.size} items (${items.inserted} new), ` +
        `${aliases.total} aliases (${aliases.inserted} new)`;
    console.log(
      `Seeded pantry catalog: ${categoryOrder.length} categories, ${counts}, ` +
        `${withPurchase} with package data.`,
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  run()
    .then(() => pool.end())
    .catch((err) => {
      console.error("Seed failed:", err.message);
      pool.end();
      process.exit(1);
    });
}
