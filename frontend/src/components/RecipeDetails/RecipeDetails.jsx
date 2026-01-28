export default function RecipeDetails({ recipe }) {
  if (!recipe) return <p>Válassz egy receptet a bal oldali listából.</p>;

  return (
    <div style={{ backgroundColor: "#7a0303d2", borderRadius: "8px", padding: "1rem" }}>
      <h2>{recipe.title || recipe.name}</h2>

      <h4>Hozzávalók:</h4>
      <ul>
        {(recipe.ingredients || []).map((ing, i) => <li key={i}>{ing}</li>)}
      </ul>

      <h4>Lépések:</h4>
      <ol>
        {(recipe.steps || []).map((step, i) => <li key={i}>{step}</li>)}
      </ol>

      <h4>Tag-ek:</h4>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {(recipe.tags || []).map(tag => (
          <span key={tag} style={{ padding: "2px 8px", backgroundColor: "#ddd", borderRadius: "8px" }}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
