import AnimatedList from "../AnimatedList/AnimatedList";

export default function RecipeListPanel({
  filterTag,
  allTags,
  filteredRecipes,
  onFilterChange,
  onSelectRecipe,
}) {
  return (
    <aside className="left-panel">
      <h3>Receptek</h3>
      <select value={filterTag} onChange={(e) => onFilterChange(e.target.value)}>
        <option value="all">Mind</option>
        {allTags.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>

      <AnimatedList
        items={filteredRecipes.map((r) => ({
          id: r.id,
          label: r.name,
        }))}
        onItemSelect={onSelectRecipe}
      />
    </aside>
  );
}
