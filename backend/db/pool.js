const { Pool } = require("pg");

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Managed hosts (Neon, Supabase) require TLS; local Postgres does not.
// Enable with DB_SSL=true in the environment.
const useSsl = process.env.DB_SSL === "true";

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: required("DB_NAME"),
  user: required("DB_USER"),
  password: required("DB_PASSWORD"),
  ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

module.exports = pool;
