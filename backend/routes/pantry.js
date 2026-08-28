const express = require("express");
const pool = require("../db/pool");

const router = express.Router();

// purchase_unit / purchase_amount are only meaningful together, and NUMERIC
// arrives from pg as a string — normalize both here so the client never sees a
// half-filled or stringly-typed package size.
function purchaseOf(row) {
  const unit = (row.purchase_unit || "").toString().trim();
  const amount = Number(row.purchase_amount);
  if (!unit || !Number.isFinite(amount) || amount <= 0) return null;
  return { unit, amount };
}

router.get("/catalog", async (req, res) => {
  try {
    const [categories, items, aliases] = await Promise.all([
      pool.query(
        "SELECT id, name, sort_order FROM pantry_categories ORDER BY sort_order, id",
      ),
      pool.query(
        "SELECT id, category_id, canonical_name, normalized_key, priority, image_url, purchase_unit, purchase_amount FROM pantry_items ORDER BY canonical_name",
      ),
      pool.query(
        "SELECT item_id, normalized_key FROM pantry_aliases ORDER BY id",
      ),
    ]);

    const aliasesByItem = new Map();
    for (const row of aliases.rows) {
      const list = aliasesByItem.get(row.item_id) || [];
      list.push(row.normalized_key);
      aliasesByItem.set(row.item_id, list);
    }

    const itemsByCategory = new Map();
    for (const row of items.rows) {
      const list = itemsByCategory.get(row.category_id) || [];
      const purchase = purchaseOf(row);
      list.push({
        id: row.id,
        canonicalName: row.canonical_name,
        normalizedKey: row.normalized_key,
        priority: row.priority,
        imageUrl: row.image_url,
        // Omitted entirely when the item has no package data, so "no data" is a
        // missing key on the client rather than a pair of nulls to check for.
        ...(purchase ? { purchase } : {}),
        aliases: aliasesByItem.get(row.id) || [],
      });
      itemsByCategory.set(row.category_id, list);
    }

    const payload = categories.rows.map((cat) => ({
      name: cat.name,
      sortOrder: cat.sort_order,
      items: itemsByCategory.get(cat.id) || [],
    }));

    return res.json({ categories: payload });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
