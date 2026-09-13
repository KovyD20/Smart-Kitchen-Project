// The pantry catalog's own ingredient names, for the AI prompts.
//
// Why: a generated or imported recipe answers in free text, so every call can
// invent a name the catalog has never heard of ("darált marhahús színhús"), and
// the frontend resolver is then left guessing which row it meant. Handing the
// model the names it should prefer means the mismatch mostly never happens --
// prevention, rather than a better guess afterwards.
//
// This deliberately does not go through routes/pantry.js: that endpoint builds
// the whole nested catalog (categories, aliases, package sizes) for the browser,
// and all this needs is one column.

// Ten minutes. The catalog changes when someone reseeds it -- a deploy-time
// event, not a request-time one -- so a long TTL costs nothing in freshness,
// while a short one would put a Postgres round trip in front of every AI call.
// Short enough that a reseed still shows up without restarting the process.
const TTL_MS = 10 * 60 * 1000;

const EMPTY = { names: [], preferred: [] };

// The sentence that does the work. Two halves on purpose: the first steers the
// model onto a catalog name, the second stops it from forcing an ingredient onto
// the nearest one it can find -- an invented "sárkánygyümölcs" is a far smaller
// problem than a confident "alma".
//
// It goes at the END of the caller's prompt rather than into SYSTEM_PROMPT: the
// system text is identical on every call, while this is data that changes with
// the catalog.
function buildCatalogNamePrompt(names) {
  if (!Array.isArray(names) || names.length === 0) return "";
  return [
    "",
    "Ha az alábbi listában van megfelelő hozzávaló, pontosan azt a nevet használd.",
    "Ha nincs közte, írd a hozzávaló szokásos magyar nevét — ne erőltesd rá a listára.",
    names.join(", "),
  ].join("\n");
}

// The cache is a factory so the tests can drive one with their own query
// function and clock; the process shares the single instance created below.
function createCatalogNameCache({ query, ttlMs = TTL_MS, now = Date.now } = {}) {
  let cached = null; // { names, preferred, at }
  let inFlight = null; // de-dupes concurrent misses into one query

  async function read() {
    const { rows } = await query(
      "SELECT canonical_name, priority FROM pantry_items ORDER BY canonical_name",
    );

    const names = [];
    const preferred = [];
    for (const row of rows || []) {
      const name = (row?.canonical_name || "").toString().trim();
      if (!name) continue;
      names.push(name);
      // Everything the user is likely to actually stock. Kept for the day a
      // prompt has to be trimmed; nothing narrows to it today.
      if (row.priority !== "extra") preferred.push(name);
    }
    return { names, preferred, at: now() };
  }

  // Never throws, and that is the whole contract: the names are a hint, and an
  // AI request must not start failing because Postgres is asleep (Render spins
  // the DB down) or the catalog table is missing. A stale cache beats none, and
  // no cache beats an error.
  async function get() {
    if (cached && now() - cached.at < ttlMs) return cached;

    if (!inFlight) {
      inFlight = read()
        .then((value) => {
          cached = value;
          return value;
        })
        .catch((err) => {
          console.error("Catalog names unavailable for the AI prompt:", err.message);
          return cached || EMPTY;
        })
        .finally(() => {
          inFlight = null;
        });
    }
    return inFlight;
  }

  return {
    get,
    prompt: async ({ preferredOnly = false } = {}) => {
      const value = await get();
      return buildCatalogNamePrompt(preferredOnly ? value.preferred : value.names);
    },
    reset: () => {
      cached = null;
      inFlight = null;
    },
  };
}

// Required lazily: db/pool throws at import time when the DB env vars are
// missing, and that must not be the reason a test (or a tool) cannot load this
// file. Nothing calls it until an AI request actually asks for the names.
const shared = createCatalogNameCache({
  query: (sql) => require("../db/pool").query(sql),
});

module.exports = {
  buildCatalogNamePrompt,
  createCatalogNameCache,
  getCatalogNames: shared.get,
  catalogNamePrompt: shared.prompt,
  resetCatalogNamesCache: shared.reset,
  TTL_MS,
};
