// The five fixed course categories. Every recipe carries exactly one, which is
// what makes them worth a colour: a chip's colour always means the same thing,
// across the filter row, the cards and the recipe header.
//
// They are stored as plain strings in `recipe.tags`, like any other tag -- a tag
// is a "main" one purely by being on this list. That keeps the whole feature free
// of a data migration, and leaves filterRecipes/recipeMatchesSearch untouched.
// The cost is that a pre-existing user tag named e.g. "Leves" is absorbed into
// this set, which is the behaviour we want anyway.
//
// The values are CSS custom properties defined in index.css. They are deliberately
// separate tokens from the --cat-* pantry accents: those are user-overridable
// (see useCategoryColors), while a course colour has to stay fixed to be readable.
export const MAIN_TAGS = [
  { name: "Reggeli", color: "var(--tag-breakfast)" },
  { name: "Leves", color: "var(--tag-soup)" },
  { name: "Főétel", color: "var(--tag-main)" },
  { name: "Desszert", color: "var(--tag-dessert)" },
  { name: "Egyéb", color: "var(--tag-misc)" },
];

// Tags the user invents get no colour of their own; neutral is the signal that
// this one is theirs, not one of the five.
export const USER_TAG_COLOR = "var(--tag-user)";

export const MAIN_TAG_NAMES = MAIN_TAGS.map((tag) => tag.name);

// Matched case-insensitively so a recipe that already carried "leves" from before
// this feature still lands in the set. The chips always write the canonical form.
const normalize = (tag) => (tag || "").toString().trim().toLocaleLowerCase("hu-HU");

const byName = new Map(MAIN_TAGS.map((tag) => [normalize(tag.name), tag]));

export function isMainTag(tag) {
  return byName.has(normalize(tag));
}

export function mainTagColor(tag) {
  return byName.get(normalize(tag))?.color || USER_TAG_COLOR;
}

// A recipe's course. Null for recipes saved before this became mandatory -- they
// render without a colour rather than being retro-fitted with a guess.
export function mainTagOf(recipe) {
  return (recipe?.tags || []).find(isMainTag) || null;
}

// Main tags first, in the order above (which is roughly the order of a meal),
// then the user's own alphabetically. Used wherever tags are listed together.
export function sortTags(tags) {
  const rank = (tag) => {
    const index = MAIN_TAG_NAMES.findIndex((name) => normalize(name) === normalize(tag));
    return index === -1 ? MAIN_TAG_NAMES.length : index;
  };

  return [...(tags || [])].sort((a, b) => {
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return (a || "").localeCompare(b || "", "hu-HU", { sensitivity: "base" });
  });
}
