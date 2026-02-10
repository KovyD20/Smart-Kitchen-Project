import { useState } from "react";
import NewRecipeForm from "../NewRecipeForm/NewRecipeForm";
import AiRecipePanel from "../AiRecipePanel/AiRecipePanel";

export default function NewRecipePanel({
  showNewRecipeForm,
  showAiPanel,
  allTags,
  fridge,
  onToggleNewRecipeForm,
  onToggleAiPanel,
  onAddTag,
  onDeleteTag,
  onCreateRecipe,
  onSaveAiRecipe,
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`right-panel${collapsed ? " panel-collapsed" : ""}`}>
      <div className="panel-header">
        <h3>Recept hozzáadás</h3>
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
          <button onClick={onToggleNewRecipeForm}>
            Új saját recept hozzáadása
          </button>

          {showNewRecipeForm && (
            <NewRecipeForm
              existingTags={allTags}
              onAddTag={onAddTag}
              onDeleteTag={onDeleteTag}
              onCreate={onCreateRecipe}
            />
          )}

          <div>
            <p>vagy</p>
          </div>

          <button onClick={onToggleAiPanel}>AI-recept generálás</button>

          {showAiPanel && (
            <AiRecipePanel fridgeItems={fridge} onSaveRecipe={onSaveAiRecipe} />
          )}
        </>
      )}
    </aside>
  );
}
