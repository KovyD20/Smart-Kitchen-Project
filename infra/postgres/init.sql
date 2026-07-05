CREATE TABLE IF NOT EXISTS demo_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO demo_items (name)
VALUES ('hello from postgres')
ON CONFLICT DO NOTHING;
