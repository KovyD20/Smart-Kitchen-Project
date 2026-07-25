

CREATE TABLE IF NOT EXISTS pantry_categories (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  sort_order INT  NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pantry_items (
  id             SERIAL PRIMARY KEY,
  category_id    INT  NOT NULL REFERENCES pantry_categories(id),
  canonical_name TEXT NOT NULL,
  normalized_key TEXT NOT NULL UNIQUE,
  priority       TEXT NOT NULL
                 CHECK (priority IN ('essential', 'good_to_have', 'extra'))
);

CREATE TABLE IF NOT EXISTS pantry_aliases (
  id             SERIAL PRIMARY KEY,
  item_id        INT  NOT NULL REFERENCES pantry_items(id) ON DELETE CASCADE,
  normalized_key TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_pantry_items_category ON pantry_items(category_id);
CREATE INDEX IF NOT EXISTS idx_pantry_aliases_item   ON pantry_aliases(item_id);
