import Icon from "../Icon/Icon";
import { recipeMeta } from "../../lib/recipes";

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
  onFilterChange,
  onSearchChange,
  onSelectRecipe,
  searchInputRef,
}) {
  const chips = ["all", ...allTags];

  const chipLabel = (tag) => (tag === "all" ? "Mind" : tag);

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
        </>
      ) : (
        <div className="view-head">
          <span className="view-title">Receptek</span>
          <span className="view-count">{totalCount} db</span>
          <div className="view-spacer" />
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
                  <span className="recipe-card-meta">{recipeMeta(recipe)}</span>
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
