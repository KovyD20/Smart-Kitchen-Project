export default function RecipeDetails({ recipe, onDelete, onEdit }) {
  if (!recipe) return null;

  const { id, name, ingredients = [], steps = [], tags = [] } = recipe;

  return (
    <div className="recipe-details">
      <h2>{name}</h2>

      <button onClick={onEdit}>Recept szerkesztése ✏️</button>

      <section>
        <h3>Hozzávalók</h3>
        {ingredients.length === 0 ? (
          <p>Nincs megadva hozzávaló.</p>
        ) : (
          <ul>
            {ingredients.map((ing, i) => (
              <li key={i}>
                {ing.amount} {ing.unit} – {ing.name}
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

      <button
        onClick={() => {
          if (confirm("Biztosan törlöd ezt a receptet?")) {
            onDelete(id);
          }
        }}
      >
        Recept törlése ❌
      </button>
    </div>
  );
}
