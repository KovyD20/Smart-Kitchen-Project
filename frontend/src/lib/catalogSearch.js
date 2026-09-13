import { normalizeCatalogText } from "../constants/catalogText";

// Typeahead over the pantry catalog: what "ke" should offer while it is being
// typed into the add-item field. Pure string work over a prebuilt index, no
// React and no catalog construction — createCatalog owns both and calls in here.
//
// This is a *search*, not the resolution ladder in pantryCatalog.js. The two
// answer different questions and must not be confused:
//
//   resolveEntry("ke")  -> null. A name the user has finished typing either is a
//                          catalog item or is not, and guessing is forbidden.
//   search("ke")        -> kefir, kenyér, kelkáposzta, ... A half-typed word is
//                          a question, and every plausible answer is welcome —
//                          the user picks, so nothing is decided on their behalf.
//
// Which is why a loose prefix rule is safe here and would not be there.

// How many rows the dropdown will ever show. Long enough that a two-letter query
// is still useful, short enough to fit on a phone without scrolling the list.
export const SUGGESTION_LIMIT = 8;

// The catalog's own "how likely is this to be in a kitchen" ordering, and the
// only sensible tie-breaker between equally good text matches: "ke" should reach
// kenyér (essential) before kelbimbó (extra).
const PRIORITY_ORDER = { essential: 0, good_to_have: 1, extra: 2 };
const priorityRank = (entry) => PRIORITY_ORDER[entry?.priority] ?? 3;

// Where in a key the typed text sits: 0 at the very start, 1 at the start of a
// later word, -1 not at a word boundary at all.
//
// Matching only at word boundaries is what makes a two-letter query useful.
// "ke" has to reach both "kefir" and "natúr kefir" — the second is the whole
// point, since the catalog names plenty of items by their qualifier first — but
// a plain substring match would also drag in "tökmag" for "ke"-like fragments
// and bury the real answers under noise.
function matchPosition(key, query) {
  if (key.startsWith(query)) return 0;
  return key.includes(` ${query}`) ? 1 : -1;
}

// Flattens a catalog into the rows the search scans: every item under its own
// key, plus one row per alias pointing at the same item. Built once per catalog
// payload, because the keys never change between queries — only the query does.
export function buildSuggestionIndex(entries, aliasPairs) {
  const index = [];

  for (const entry of entries || []) {
    index.push({ key: entry.key, entry, alias: null });
  }
  // `aliasPairs` is the alias -> entry map as it lives in the catalog, so the
  // keys arrive already normalized (the backend stores them that way).
  for (const [aliasKey, entry] of aliasPairs || []) {
    index.push({ key: aliasKey, entry, alias: aliasKey });
  }

  return index;
}

function compareSuggestions(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;

  const priority = priorityRank(a.entry) - priorityRank(b.entry);
  if (priority !== 0) return priority;

  // Among equals the shorter name is the more general one — "tej" before
  // "tejföl" — and a prefix query is usually reaching for the general one.
  if (a.entry.name.length !== b.entry.name.length) {
    return a.entry.name.length - b.entry.name.length;
  }
  return a.entry.name.localeCompare(b.entry.name, "hu-HU", {
    sensitivity: "base",
  });
}

// The suggestions for a half-typed name, best first.
//
// Each result is { entry, alias }: `entry` is the catalog item to offer, `alias`
// the spelling that matched when it was not the item's own name ("krumpli" ->
// burgonya), so the row can show why it is there.
export function searchSuggestions(index, rawQuery, limit = SUGGESTION_LIMIT) {
  // Through normalizeCatalogText, so the query is folded exactly the way the
  // keys were: "ká" finds "kávé", and an accent nobody feels like typing on a
  // phone keyboard costs nothing.
  const query = normalizeCatalogText(rawQuery);
  if (!query) return [];

  // One row per catalog item, keeping its best match. An item reachable both by
  // its own name and by an alias must appear once, ranked by the better of the
  // two — not twice, which is what a plain list would produce.
  const best = new Map();

  for (const row of index || []) {
    const position = matchPosition(row.key, query);
    if (position < 0) continue;

    // An alias is a weaker signal than the item's own name: "krumpli" should
    // reach burgonya, but an item actually spelled that way still comes first.
    const rank = position + (row.alias ? 2 : 0);

    const previous = best.get(row.entry.key);
    if (previous && previous.rank <= rank) continue;
    best.set(row.entry.key, { entry: row.entry, alias: row.alias, rank });
  }

  return Array.from(best.values()).sort(compareSuggestions).slice(0, limit);
}
