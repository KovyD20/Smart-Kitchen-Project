import { useMemo, useState } from "react";
import NewRecipeForm from "../NewRecipeForm/NewRecipeForm";
import RecipeDetails from "../RecipeDetails/RecipeDetails";

export default function RecipeDisplayPanel({
  editingRecipe,
  selectedRecipe,
  allTags,
  onAddTag,
  onDeleteTag,
  onSaveEdit,
  onDeleteRecipe,
  onEditRecipe,
  onAddToShoppingList,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const title = useMemo(() => {
    if (editingRecipe) return "Recept szerkesztése";
    if (selectedRecipe?.name) return selectedRecipe.name;
    return "Recept";
  }, [editingRecipe, selectedRecipe]);

  return (
    <main className={`center-panel${collapsed ? " panel-collapsed" : ""}`}>
      <div className="panel-header">
        <h3>{title}</h3>
        <button
          type="button"
          className="panel-toggle"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {collapsed ? ">" : "-"}
        </button>
      </div>

      {!collapsed && (
        <>
          {editingRecipe ? (
            <NewRecipeForm
              editMode
              recipe={editingRecipe}
              existingTags={allTags}
              onAddTag={onAddTag}
              onDeleteTag={onDeleteTag}
              onSave={onSaveEdit}
            />
          ) : selectedRecipe ? (
            <RecipeDetails
              recipe={selectedRecipe}
              onDelete={onDeleteRecipe}
              onEdit={onEditRecipe}
              onAddToShoppingList={onAddToShoppingList}
            />
          ) : (
            <div className="recipe-details">
              Kattints egy meglévő receptre, vagy adj hozzá újat a listához.
            </div>
          )}
        </>
      )}
    </main>
  );
}
