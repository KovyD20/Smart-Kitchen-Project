import Icon from "../Icon/Icon";
import {
  availabilityLevel,
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
  const chips = ["all", ...allTags];

  const chipLabel = (tag) => (tag === "all" ? "Mind" : tag);

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
          className={`chip${filterTag === tag ? " is-active" : ""}`}
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
                  <Icon name="bowl" size={isMobile ? 17 : 32} />
                </span>
                <span className="recipe-card-body">
                  <span className="recipe-card-name">{recipe.name}</span>
                  <CardMeta
                    recipe={recipe}
                    availability={availabilityFor(recipe)}
                  />
                  {/* Desktop stacks the tag under the meta line; the mobile row
                      puts it beside the text, before the chevron. */}
                  {!isMobile && recipe.tags?.[0] && (
                    <span className="tag-pill">{recipe.tags[0]}</span>
                  )}
                </span>
                {isMobile && (
                  <>
                    {recipe.tags?.[0] && (
                      <span className="tag-pill">{recipe.tags[0]}</span>
                    )}
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
