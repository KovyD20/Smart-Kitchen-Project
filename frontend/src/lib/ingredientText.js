import { normalizeCatalogText } from "../constants/catalogText";

// Cleans the *input* text of an ingredient name before it is looked up in the
// catalog. Pure string work: no catalog, no React.
//
// This is deliberately NOT part of normalizeCatalogText. That function is
// duplicated with the backend and pins the shape of the stored keys; this one
// only prepares a query, and lives on the frontend alone.
//
// The rule is an ALLOWLIST, not "strip the extra words". The naive rule is
// dangerous, because in Hungarian a leading word can just as easily name a
// different product:
//
//   vaníliás cukor      -> cukor   WRONG, different product
//   porcukor            -> cukor   WRONG, and it has its own catalog row
//   teljes kiőrlésű liszt -> liszt WRONG, different product
//   tojássárgája        -> tojás   WRONG, you do not buy yolks separately
//
// So only words known to be harmless are removed. Anything unrecognised stays
// as it is and lands in "Egyéb", which is the safe outcome.

// Words that describe the *state* of an ingredient, not what you buy: nobody
// sells lukewarm milk. Closed list, extend it consciously.
const STATE_WORDS = [
  "langyos",
  "friss",
  "olvasztott",
  "őrölt",
  "morzsolt",
  "reszelt",
  "darált",
  "aprított",
  "felkockázott",
  "hámozott",
  "szobahőmérsékletű",
  "főtt",
  "nyers",
  "szárított",
  "száraz",
  "fagyasztott",
  "konyhakész",
  // A size has to come off the name for "nagy marha velőscsont" to resolve, but
  // it is not noise: which one to pick off the shelf is worth knowing, so it
  // survives the stripping as a note on the row.
  "nagy",
  "kicsi",
  // A cut, not a product: "csirkemell filé" is chicken breast.
  "filé",
];

// Compared through normalizeCatalogText so that "Őrölt", "őrölt" and "orolt"
// are the same word. Reusing that function rather than folding accents a fourth
// time in this repo is the point.
const STATE_WORD_KEYS = new Set(STATE_WORDS.map(normalizeCatalogText));

// "porcukor a szóráshoz" -> "porcukor". A grammatical pattern rather than a
// dictionary: `a`/`az`, then up to four words, the last of which ends in
// -hoz/-hez/-höz/-ra/-re, at the very end of the name. More than one word in
// between is the common case ("a tepsi kikenéséhez"), but it is capped so a
// stray " a " in the middle of a name cannot swallow the rest of it.
//
// Both spellings of the ending are listed because one caller passes the raw
// name ("kikenéshöz") and the other an accent-folded one ("kikeneshoz").
const PURPOSE_SUFFIX = /\s+az?\s+(?:\S+\s+){0,3}\S+(hoz|hez|höz|ra|re)\s*$/i;

// Not products at all: they come out of the tap, so they have no place on a
// shopping list. They must still be kept in the recipe, where they are a
// legitimate ingredient — this set is only consulted on the way to the list.
export const IGNORED_INGREDIENTS = new Set(
  ["víz", "csapvíz", "jég"].map(normalizeCatalogText),
);

export function isIgnoredIngredient(name) {
  return IGNORED_INGREDIENTS.has(normalizeCatalogText(name));
}

const words = (value) => (value || "").toString().trim().split(/\s+/).filter(Boolean);

function withoutPurposeSuffix(value) {
  const raw = (value || "").toString().trim();
  // Guard against eating the whole name: "a kenéshez" on its own is not a name,
  // but neither is "" — leave such input alone and let it fail to resolve.
  const stripped = raw.replace(PURPOSE_SUFFIX, "").trim();
  return stripped || raw;
}

function withoutStateWords(value) {
  const kept = words(value).filter(
    (word) => !STATE_WORD_KEYS.has(normalizeCatalogText(word)),
  );
  // All words were modifiers ("darált" alone): keep the original rather than
  // return nothing.
  return kept.length ? kept.join(" ") : (value || "").toString().trim();
}

// The state words this name carries, in the order they appear. The resolver
// throws the words away; the shopping list keeps them as a note on the row, so
// "reszelt" is not lost when the row is named after the product you buy.
//
// Two things decide what a note may look like, and both belong here rather than
// in the hook that collects them:
//
//   - it is always lowercase. The word is lifted out of a name, not written as
//     a sentence, so "Reszelt parmezán sajt" leaves "reszelt" under the row.
//   - a word the row's own name already says is not a reminder of anything.
//     Pass `canonicalName` and "darált" drops off "darált sertés", while "nagy"
//     stays on "velőscsont" — the size is the one that still tells you which
//     one to pick up.
export function strippedModifiers(name, canonicalName = "") {
  const alreadySaid = new Set(words(canonicalName).map(normalizeCatalogText));
  return words(withoutPurposeSuffix(name))
    .filter((word) => {
      const key = normalizeCatalogText(word);
      return STATE_WORD_KEYS.has(key) && !alreadySaid.has(key);
    })
    .map((word) => word.toLocaleLowerCase("hu-HU"));
}

// The spellings to try in the catalog, in order, **the untouched name first**.
//
// That order is the load-bearing part. "darált hús", "őrölt kávé" and
// "szárított tárkony" are all catalog items whose first word is on the state
// list; trying the full name first is what stops the cleaner from turning them
// into "hús", "kávé" and "tárkony". Any future item of that shape is protected
// by construction rather than by a special case.
export function ingredientNameCandidates(name) {
  const raw = (name || "").toString().trim();
  if (!raw) return [];

  const noPurpose = withoutPurposeSuffix(raw);
  const candidates = [
    raw,
    noPurpose,
    withoutStateWords(raw),
    withoutStateWords(noPurpose),
  ];

  const seen = new Set();
  return candidates.filter((candidate) => {
    if (!candidate || seen.has(candidate)) return false;
    seen.add(candidate);
    return true;
  });
}
