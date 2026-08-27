-- Pantry catalog schema (the global, relational domain served from PostgreSQL).
--
-- Applied by `npm run migrate` (backend/scripts/migrate.js). Every statement is
-- idempotent, so re-running it against an existing database is a no-op — that
-- makes it safe to run on every deploy of a managed instance (Neon/Supabase),
-- which has no equivalent of the Docker entrypoint init hook.
--
-- Note on normalized_key: `normalizeCatalogText` (accent stripping, lowercasing,
-- punctuation cleanup) is an algorithm, not data. The keys stored here are
-- computed at seed time by backend/lib/normalize.js, and incoming runtime text is
-- normalized by that same module — so lookups and stored keys cannot drift apart.

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

-- Optional per-item thumbnail override. While NULL the frontend falls back to
-- its conventional `public/pantry/{normalized_key}.webp` path, so the static
-- asset set works with no data here; setting a URL is the migration path to a
-- CDN or to user-uploaded images without a frontend change.
ALTER TABLE pantry_items ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE TABLE IF NOT EXISTS pantry_aliases (
  id             SERIAL PRIMARY KEY,
  item_id        INT  NOT NULL REFERENCES pantry_items(id) ON DELETE CASCADE,
  normalized_key TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_pantry_items_category ON pantry_items(category_id);
CREATE INDEX IF NOT EXISTS idx_pantry_aliases_item   ON pantry_aliases(item_id);
