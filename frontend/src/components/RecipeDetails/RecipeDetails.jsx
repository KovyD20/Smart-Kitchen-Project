import { useEffect, useMemo, useState } from "react";
import "./RecipeDetails.css";

export default function RecipeDetails({
  recipe,
  onDelete,
  onEdit,
  onAddToShoppingList,
}) {
  const {
    id,
    name,
    ingredients = [],
    steps = [],
    tags = [],
    servings,
    time,
    time_minutes,
  } = recipe || {};

  const baseServings = useMemo(() => {
    const parsed = Number(servings);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }, [servings]);

  const [currentServings, setCurrentServings] = useState(baseServings);

  useEffect(() => {
    setCurrentServings(baseServings);
  }, [id, baseServings]);

  const formatAmount = (value) => {
    if (!Number.isFinite(value)) return value;
    return Number(value.toFixed(2)).toString();
  };

  const scaledIngredients = useMemo(() => {
    return ingredients.map((ingredient) => {
      const amount = Number(ingredient.amount);
      if (!Number.isFinite(amount)) return ingredient;
      const scaled = (amount * currentServings) / baseServings;
      return { ...ingredient, amount: formatAmount(scaled) };
    });
  }, [ingredients, currentServings, baseServings]);

  const displayedTime = time ?? time_minutes;

  if (!recipe) return null;

  return (
    <div className="recipe-details">
      <h2>{name}</h2>

      <button onClick={() => onAddToShoppingList(scaledIngredients)}>
        Bevásárlólistához ad
      </button>

      <section>
        <h3>Hozzávalók</h3>
        {scaledIngredients.length === 0 ? (
          <p>Nincs megadva hozzávaló.</p>
        ) : (
          <ul>
            {scaledIngredients.map((ing, i) => (
              <li key={i}>
                <span className="amount-highlight">
                  {ing.amount} {ing.unit}
                </span>{" "}
                - {ing.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3>Elkészítés</h3>
        {steps.length === 0 ? (
          <p>Nincs megadva elkészítési lépés.</p>
        ) : (
          <ol>
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        )}
      </section>

      {tags.length > 0 && (
        <section>
          <h3>Tag-ek</h3>
          <div className="recipe-tags">{tags.join(", ")}</div>
        </section>
      )}

      <div>
        <h4>Adag: {currentServings}</h4>
        {displayedTime !== undefined &&
          displayedTime !== null &&
          displayedTime !== "" && <h4>Idő: {displayedTime} perc</h4>}
        <button onClick={() => setCurrentServings((prev) => Math.max(1, prev - 1))}>
          -
        </button>
        <button onClick={() => setCurrentServings((prev) => prev + 1)}>+</button>
      </div>

      <button onClick={onEdit}>Recept szerkesztése</button>

      <button
        onClick={() => {
          if (confirm("Biztosan törlöd ezt a receptet?")) {
            onDelete(id);
          }
        }}
      >
        Recept törlése
      </button>
    </div>
  );
}
