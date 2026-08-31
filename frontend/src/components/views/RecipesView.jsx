import Icon from "../Icon/Icon";
import {
  isMainTag,
  mainTagColor,
  mainTagOf,
  sortTags,
} from "../../constants/recipeTags";
import {
  availabilityLevel,
  FAVORITES_FILTER,
  recipeAvailability,
  recipeMeta,
  recipeTimeLabel,
} from "../../lib/recipes";

const SORT_MODES = [
  { id: "name", label: "Név szerint" },
  { id: "availability", label: "Ami megvan" },
];

// Two-state toggle above the list. Reuses the tag chips' look so it reads as part
// of the same filter row.
function SortToggle({ sortMode, onSortChange }) {
  return (
    <div className="chip-row sort-row" role="group" aria-label="Rendezés">
      {SORT_MODES.map((mode) => (
        <button
          key={mode.id}
          type="button"
          className={`chip${sortMode === mode.id ? " is-active" : ""}`}
          aria-pressed={sortMode === mode.id}
          onClick={() => onSortChange(mode.id)}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

// "5/8 hozzávaló · 90 perc" when the fridge is known, otherwise the plain
// "8 hozzávaló · 90 perc". The count sits in its own element so it can be
// coloured by how much of the recipe is actually available.
function CardMeta({ recipe, availability }) {
  if (!availability || availability.total === 0) {
    return <span className="recipe-card-meta">{recipeMeta(recipe)}</span>;
  }

  const time = recipeTimeLabel(recipe);
  return (
    <span className="recipe-card-meta">
      <span className={`recipe-card-avail is-${availabilityLevel(availability)}`}>
        {availability.have}/{availability.total} hozzávaló
      </span>
      {time && ` · ${time}`}
    </span>
  );
}

// "Receptek" — the recipe browser. Cards with artwork on desktop, compact rows
// on mobile (the layout switch lives in CSS).
// The card's badge names the course rather than tags[0], which was whichever tag
// happened to be stored first. Recipes saved before courses existed have none,
// and show nothing rather than a guess.
function CourseBadge({ recipe }) {
  const course = mainTagOf(recipe);
  if (!course) return null;
  return (
    <span className="tag-pill" style={{ "--tag-accent": mainTagColor(course) }}>
      {course}
    </span>
  );
}

export default function RecipesView({
  recipes,
  totalCount,
  selectedId,
  filterTag,
  allTags,
  search,
  isMobile,
  sortMode,
  fridge,
  resolveCatalogKey,
  onSortChange,
  onFilterChange,
  onSearchChange,
  onSelectRecipe,
  searchInputRef,
}) {
  // Favourites sit right after "Mind", ahead of the tags; sortTags then puts the
  // five courses before anything the user invented.
  const chips = ["all", FAVORITES_FILTER, ...sortTags(allTags)];

  const chipLabel = (tag) => {
    if (tag === "all") return "Mind";
    if (tag === FAVORITES_FILTER) {
      return (
        <>
          <Icon name="star" size={11} />
          Kedvencek
        </>
      );
    }
    return tag;
  };

  // Only meaningful once the fridge is known; without it the cards fall back to
  // the plain ingredient count.
  const availabilityFor = (recipe) =>
    resolveCatalogKey ? recipeAvailability(recipe, fridge, resolveCatalogKey) : null;

  const tagChips = (
    <div className="chip-row">
      {chips.map((tag) => (
        <button
          key={tag}
          type="button"
          className={`chip${filterTag === tag ? " is-active" : ""}${
            tag === FAVORITES_FILTER ? " chip-fav" : ""
          }${isMainTag(tag) ? " chip-course" : ""}`}
          // "Mind" and "Kedvencek" are not tags, so they keep the neutral look.
          style={
            tag === "all" || tag === FAVORITES_FILTER
              ? undefined
              : { "--tag-accent": mainTagColor(tag) }
          }
          onClick={() => onFilterChange(tag)}
        >
          {chipLabel(tag)}
        </button>
      ))}
    </div>
  );

  return (
    <div className="view">
      {isMobile ? (
        <>
          <div className="search-box">
            <Icon name="search" size={13} color="#7a7a7a" />
            <input
              ref={searchInputRef}
              placeholder="Keresés a receptek közt"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          {tagChips}
          <SortToggle sortMode={sortMode} onSortChange={onSortChange} />
        </>
      ) : (
        <div className="view-head">
          <span className="view-title">Receptek</span>
          <span className="view-count">{totalCount} db</span>
          <div className="view-spacer" />
          <SortToggle sortMode={sortMode} onSortChange={onSortChange} />
          {tagChips}
        </div>
      )}

      <div className="view-scroll">
        {recipes.length === 0 ? (
          <div className="empty-state">
            {totalCount === 0
              ? "Még nincs receptem. Vedd fel az elsőt az „Új recept” fülön."
              : "Nincs a szűrésnek megfelelő recept."}
          </div>
        ) : (
          <div className="grid grid-4">
            {recipes.map((recipe) => (
              <button
                key={recipe.id}
                type="button"
                className={`recipe-card${
                  recipe.id === selectedId ? " is-selected" : ""
                }`}
                onClick={() => onSelectRecipe(recipe)}
              >
                <span className="recipe-card-art">
                  {recipe.imageUrl ? (
                    <img
                      className="recipe-card-img"
                      src={recipe.imageUrl}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                    />
                  ) : (
                    <Icon name="bowl" size={isMobile ? 17 : 32} />
                  )}
                </span>
                {recipe.favorite && (
                  <span className="recipe-card-fav" title="Kedvenc">
                    <Icon name="star" size={isMobile ? 11 : 13} />
                  </span>
                )}
                <span className="recipe-card-body">
                  <span className="recipe-card-name">{recipe.name}</span>
                  <CardMeta
                    recipe={recipe}
                    availability={availabilityFor(recipe)}
                  />
                  {/* Desktop stacks the tag under the meta line; the mobile row
                      puts it beside the text, before the chevron. */}
                  {!isMobile && <CourseBadge recipe={recipe} />}
                </span>
                {isMobile && (
                  <>
                    <CourseBadge recipe={recipe} />
                    <Icon name="chevronRight" size={12} color="#6a6a6a" />
                  </>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
