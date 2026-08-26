// Accent colour per pantry category, so the shopping list and the fridge stop
// rendering every category card in the same view-level accent.
//
// The keys are the category names AFTER backend/scripts/seedPantry.js's
// normalizeCategory(), which strips the leading "9. " ordering prefix -- so
// "Snackek", never "9. Snackek". categoryColors.test.js checks this list against
// the seed data, so a newly seeded category cannot silently fall back to grey.
//
// The values are CSS custom properties defined in index.css; keeping them as
// tokens rather than literal hex means the palette stays editable in one place.
const CATEGORY_COLORS = {
  "Zöldségek": "var(--cat-vegetables)",
  "Gyümölcsök": "var(--cat-fruits)",
  "Pékáruk": "var(--cat-bakery)",
  "Húsfélék": "var(--cat-meat)",
  "Felvágottak": "var(--cat-deli)",
  "Tejtermékek, tojás": "var(--cat-dairy)",
  "Fagyasztott termékek": "var(--cat-frozen)",
  "Szárazáru": "var(--cat-dry)",
  "Fűszerek, ízesítők": "var(--cat-spices)",
  "Üdítők, italok": "var(--cat-drinks)",
  "Snackek": "var(--cat-snacks)",
  // The seed splits household goods in two, and both land in the same grid, so
  // they get separate shades rather than one shared grey.
  "Háztartási alapcikkek (konyha)": "var(--cat-household)",
  "Háztartási alapcikkek (fürdő)": "var(--cat-household-bath)",
  // pantryCatalog.js's UNKNOWN_CATEGORY, for items the catalog does not know.
  "Egyéb": "var(--cat-other)",
};

export const CATEGORY_COLOR_KEYS = Object.keys(CATEGORY_COLORS);

// The choices offered by the category ColorPicker. A closed set instead of a free
// colour input: every value here also renders as text and as a border on --card,
// so unrestricted choice would let the user make the UI unreadable.
export const COLOR_SWATCHES = [
  "#6ee7a0",
  "#67d5e0",
  "#7fc7ff",
  "#8fb2c4",
  "#9b8cff",
  "#b98cff",
  "#d98cb3",
  "#ff8fb1",
  "#e5383b",
  "#ff7a45",
  "#ffb020",
  "#f0c96a",
  "#d9a05b",
  "#c9b458",
  "#9aa0a6",
  "#cfcfcf",
];

// The fixed-palette accent for a category. Unknown categories stay readable
// instead of inheriting whatever accent the surrounding view happens to use.
export function categoryAccent(category) {
  return CATEGORY_COLORS[category] || "var(--cat-other)";
}
