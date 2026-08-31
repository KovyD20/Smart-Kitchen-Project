import { useState } from "react";
import Icon from "../Icon/Icon";
import { groupIngredients, recipeMeta, splitByFridge } from "../../lib/recipes";
import { mainTagColor, mainTagOf } from "../../constants/recipeTags";

function Servings({ value, onChange }) {
  return (
    <div className="servings">
      <button
        type="button"
        className="icon-btn"
        aria-label="Kevesebb adag"
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        <Icon name="minus" size={11} />
      </button>
      <span className="servings-value">{value} adag</span>
      <button
        type="button"
        className="icon-btn"
        aria-label="Több adag"
        onClick={() => onChange(value + 1)}
      >
        <Icon name="plus" size={11} />
      </button>
    </div>
  );
}

function IngredientRow({ ingredient, onAdd }) {
  const note = ingredient.note?.trim();
  return (
    <div className="ing-row">
      <span className="ing-qty">
        {ingredient.amount} {ingredient.unit}
      </span>
      <span className="ing-name">
        {ingredient.name}
        {note && <span className="ing-note">{note}</span>}
      </span>
      <button
        type="button"
        className="icon-btn ing-add"
        aria-label={`${ingredient.name} a bevásárlólistára`}
        onClick={() => onAdd(ingredient)}
      >
        <Icon name="plus" size={11} />
      </button>
    </div>
  );
}

// The ingredient list, sectioned by the optional `group` field. A recipe that
// uses no groups renders exactly as before: one unnamed block, no headings.
function IngredientList({ ingredients, onAdd }) {
  if (ingredients.length === 0) {
    return <div className="empty-state">Nincs megadva hozzávaló.</div>;
  }

  return groupIngredients(ingredients).map((block, blockIndex) => (
    <div key={blockIndex} className="ing-group">
      {block.group && <div className="ing-group-label">{block.group}</div>}
      {block.items.map((ingredient, i) => (
        <IngredientRow key={i} ingredient={ingredient} onAdd={onAdd} />
      ))}
    </div>
  ));
}

// The recipe's course, in the same colour it has on the cards and in the filter
// row. Absent on recipes saved before courses existed.
function CourseBadge({ recipe }) {
  const course = mainTagOf(recipe);
  if (!course) return null;
  return (
    <span className="tag-pill" style={{ "--tag-accent": mainTagColor(course) }}>
      {course}
    </span>
  );
}

function StepRow({ index, text }) {
  return (
    <div className="step-row">
      <span className="step-n">{index + 1}</span>
      <span className="step-text">{text}</span>
    </div>
  );
}

// "Recept" — the selected recipe. Desktop shows ingredients / steps / fridge
// match side by side; mobile shows a segmented switch between the first two.
export default function RecipeView({
  recipe,
  ingredients,
  steps,
  fridge,
  resolveCatalogKey,
  servings,
  isMobile,
  onServingsChange,
  onStartCook,
  onAddIngredient,
  onAddAllToCart,
  onAddMissingToCart,
  onToggleFavorite,
  onEdit,
  onDelete,
  onGoToRecipes,
}) {
  const [mobileTab, setMobileTab] = useState("ing");

  if (!recipe) {
    return (
      <div className="view">
        <div className="empty-state">
          Nincs kiválasztott recept.{" "}
          <button type="button" className="link-btn" onClick={onGoToRecipes}>
            Válassz a receptek közül →
          </button>
        </div>
      </div>
    );
  }

  const { have, missing } = splitByFridge(
    ingredients,
    fridge,
    resolveCatalogKey,
  );

  const tools = (
    <>
      <Servings value={servings} onChange={onServingsChange} />
      <button
        type="button"
        className={`icon-btn${recipe.favorite ? " is-favorite" : ""}`}
        aria-label={
          recipe.favorite ? "Kedvencek közül eltávolít" : "Kedvencekhez ad"
        }
        aria-pressed={Boolean(recipe.favorite)}
        onClick={onToggleFavorite}
      >
        <Icon name="star" size={12} />
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label="Recept szerkesztése"
        onClick={onEdit}
      >
        <Icon name="pen" size={12} />
      </button>
      <button
        type="button"
        className="icon-btn danger"
        aria-label="Recept törlése"
        onClick={onDelete}
      >
        <Icon name="trash" size={12} />
      </button>
    </>
  );

  if (isMobile) {
    return (
      <div className="view">
        <div className="recipe-head">
          <div className="recipe-head-text">
            <div className="recipe-head-name">{recipe.name}</div>
            <div className="recipe-head-meta">{recipeMeta(recipe)}</div>
            <CourseBadge recipe={recipe} />
          </div>
        </div>

        <div className="recipe-actions">
          <button
            type="button"
            className="btn-pill btn-solid"
            disabled={steps.length === 0}
            onClick={onStartCook}
          >
            <Icon name="burner" size={14} />
            Főzés mód
          </button>
          <button
            type="button"
            className="btn-icon-outline"
            style={{ "--accent": "var(--yellow)" }}
            aria-label="Minden hozzávaló a listára"
            onClick={onAddAllToCart}
          >
            <Icon name="cartPlus" size={16} />
          </button>
        </div>

        <div className="recipe-tools">{tools}</div>

        <div className="segmented">
          <button
            type="button"
            className={mobileTab === "ing" ? "is-active" : ""}
            onClick={() => setMobileTab("ing")}
          >
            Hozzávalók
          </button>
          <button
            type="button"
            className={mobileTab === "steps" ? "is-active" : ""}
            onClick={() => setMobileTab("steps")}
          >
            Elkészítés
          </button>
        </div>

        {mobileTab === "ing" ? (
          <div className="mobile-stack">
            <IngredientList ingredients={ingredients} onAdd={onAddIngredient} />
          </div>
        ) : (
          <div className="mobile-stack">
            {steps.length === 0 ? (
              <div className="empty-state">Nincs megadva elkészítési lépés.</div>
            ) : (
              steps.map((step, i) => <StepRow key={i} index={i} text={step} />)
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="view">
      <div className="recipe-head">
        <span className="recipe-head-art">
          {recipe.imageUrl ? (
            <img
              className="recipe-head-img"
              src={recipe.imageUrl}
              alt=""
              aria-hidden="true"
            />
          ) : (
            <Icon name="bowl" size={20} />
          )}
        </span>
        <div className="recipe-head-text">
          <div className="recipe-head-name">{recipe.name}</div>
          <div className="recipe-head-meta">{recipeMeta(recipe)}</div>
          <CourseBadge recipe={recipe} />
        </div>
        {tools}
        <button
          type="button"
          className="btn-pill btn-outline"
          style={{ "--accent": "var(--yellow)" }}
          onClick={onAddAllToCart}
        >
          <Icon name="cartPlus" size={13} />
          Listához ad
        </button>
        <button
          type="button"
          className="btn-pill btn-solid"
          disabled={steps.length === 0}
          onClick={onStartCook}
        >
          <Icon name="burner" size={13} />
          Főzés mód
        </button>
      </div>

      <div className="recipe-cols">
        <section className="panel" style={{ "--accent": "var(--green)" }}>
          <header className="panel-head">
            <span className="panel-title">Hozzávalók</span>
          </header>
          <div className="panel-body">
            <IngredientList ingredients={ingredients} onAdd={onAddIngredient} />
          </div>
        </section>

        <section
          className="panel panel-steps"
          style={{ "--accent": "var(--orange)" }}
        >
          <header className="panel-head">
            <span className="panel-title">Elkészítés</span>
          </header>
          <div className="panel-body steps-body">
            {steps.length === 0 ? (
              <div className="empty-state">Nincs megadva elkészítési lépés.</div>
            ) : (
              steps.map((step, i) => <StepRow key={i} index={i} text={step} />)
            )}
          </div>
        </section>

        <section className="panel" style={{ "--accent": "var(--blue)" }}>
          <header className="panel-head">
            <Icon name="snowflake" size={14} color="var(--blue)" />
            <span className="panel-title">Mi van meg?</span>
          </header>
          <div className="panel-body stock-body">
            <div className="stock-group" style={{ "--accent": "var(--green)" }}>
              <div className="stock-label">{have.length} megvan a hűtőben</div>
              {have.map((ingredient, i) => (
                <div key={i} className="stock-have">
                  <Icon name="check" size={11} color="var(--green)" />
                  <span>{ingredient.name}</span>
                </div>
              ))}
            </div>

            <div className="stock-group" style={{ "--accent": "#e0a04a" }}>
              <div className="stock-label">{missing.length} hiányzik</div>
              {missing.map((ingredient, i) => (
                <div key={i} className="stock-missing">
                  <span className="stock-missing-qty">
                    {ingredient.amount} {ingredient.unit}
                  </span>
                  <span className="stock-missing-name">{ingredient.name}</span>
                </div>
              ))}
            </div>
          </div>
          <footer className="panel-foot">
            <button
              type="button"
              className="btn-pill btn-yellow"
              disabled={missing.length === 0}
              onClick={() => onAddMissingToCart(missing)}
            >
              <Icon name="cartPlus" size={13} />
              Hiányzók listára
            </button>
          </footer>
        </section>
      </div>
    </div>
  );
}
