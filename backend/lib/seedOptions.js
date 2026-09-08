// How the seed should run, and which database it is about to change.
//
// These live outside scripts/seedPantry.js so they can be tested without
// requiring that script — requiring it pulls in db/pool.js, which throws when
// DB_NAME is unset, and CI has no .env. Keeping the safety-critical decision in
// an env-independent module is what makes it coverable at all.

// Only `--reset` opts into the destructive path. Anything else — no flags, a
// typo, an unknown flag — stays on the additive one, because the failure mode of
// guessing wrong here is a wiped catalog.
function parseSeedArgs(argv = []) {
  return { reset: Array.isArray(argv) && argv.includes("--reset") };
}

// Printed before any write. "Which database am I about to change?" should never
// be a guess: a local .env pointing at the managed instance is exactly how the
// catalog gets wiped. Credentials are deliberately not part of this string.
function describeTarget(env = process.env) {
  const host = env.DB_HOST || "localhost";
  const port = env.DB_PORT || 5432;
  const name = env.DB_NAME || "(unset)";
  const ssl = env.DB_SSL === "true" ? " ssl" : "";
  return `${host}:${port}/${name}${ssl}`;
}

module.exports = { parseSeedArgs, describeTarget };
