import { useState } from "react";
import "./AiRecipePanel.css";

export default function AiRecipePanel({ onSaveRecipe, fridgeItems = [] }) {
  const [nameInput, setNameInput] = useState("");
  const [options, setOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState("");
  const [recipe, setRecipe] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadingName, setLoadingName] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingFridgeRecipe, setLoadingFridgeRecipe] = useState(false);
  const [savingRecipe, setSavingRecipe] = useState(false);

  const clearError = () => setError("");
  const clearSuccess = () => setSuccess("");

  const handleRecipeByName = async () => {
    const name = nameInput.trim();
    if (!name) return;

    clearError();
    clearSuccess();
    setRecipe(null);
    setLoadingName(true);

    try {
      const res = await fetch("/api/ai/recipe-by-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "AI hiba");
        return;
      }

      setRecipe(data.recipe || null);
    } catch (err) {
      setError("AI kérés sikertelen");
    } finally {
      setLoadingName(false);
    }
  };

  const handleSuggestFromFridge = async () => {
    clearError();
    clearSuccess();
    setRecipe(null);
    setOptions([]);
    setSelectedOption("");
    setLoadingOptions(true);

    try {
      const res = await fetch("/api/ai/suggest-from-fridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: fridgeItems }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data?.error === "Fridge is empty") {
          setError("A hűtő üres");
        } else {
          setError(data?.error || "AI hiba");
        }
        return;
      }

      const nextOptions = Array.isArray(data.options) ? data.options : [];
      setOptions(nextOptions);
      setSelectedOption(nextOptions[0] || "");
    } catch (err) {
      setError("AI kérés sikertelen");
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleRecipeFromFridge = async () => {
    const name = selectedOption.trim();
    if (!name) return;

    clearError();
    clearSuccess();
    setRecipe(null);
    setLoadingFridgeRecipe(true);

    try {
      const res = await fetch("/api/ai/recipe-from-fridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, items: fridgeItems }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data?.error === "Fridge is empty") {
          setError("A hűtő üres");
        } else {
          setError(data?.error || "AI hiba");
        }
        return;
      }

      setRecipe(data.recipe || null);
    } catch (err) {
      setError("AI kérés sikertelen");
    } finally {
      setLoadingFridgeRecipe(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (!recipe?.name) return;

    clearError();
    clearSuccess();
    setSavingRecipe(true);

    const payload = {
      name: recipe.name,
      ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
      steps: Array.isArray(recipe.steps) ? recipe.steps : [],
      tags: Array.isArray(recipe.tags) ? recipe.tags : [],
    };

    try {
      if (!onSaveRecipe) {
        setError("Mentés nem elérhető");
        return;
      }

      await onSaveRecipe(payload);
      setSuccess("AI-recept elmentve a saját receptjeid közé");
      setRecipe(null);
    } catch (err) {
      setError("Mentés sikertelen");
    } finally {
      setSavingRecipe(false);
    }
  };

  return (
    <div className="ai-panel">
      <h3>AI-recept generálás</h3>

      <div className="ai-block">
        <div className="ai-row">
          <input
            placeholder="Recept neve (pl. gulyásleves)"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
          />
          <button onClick={handleRecipeByName} disabled={loadingName}>
            {loadingName ? "Generálás..." : "Recept generálás név alapján"}
          </button>
        </div>
      </div>

      <div className="ai-block">
        <button onClick={handleSuggestFromFridge} disabled={loadingOptions}>
          {loadingOptions ? "Keresés..." : "Ötletek a hűtőből"}
        </button>

        {options.length > 0 && (
          <div className="ai-options">
            <div className="ai-options-title">AI választásai</div>
            {options.map((opt) => (
              <label key={opt} className="ai-option">
                <input
                  type="radio"
                  name="ai-option"
                  value={opt}
                  checked={selectedOption === opt}
                  onChange={() => setSelectedOption(opt)}
                />
                <span>{opt}</span>
              </label>
            ))}

            <button
              onClick={handleRecipeFromFridge}
              disabled={loadingFridgeRecipe || !selectedOption}
            >
              {loadingFridgeRecipe ? "Generálás..." : "Recept a hűtőből"}
            </button>
          </div>
        )}
      </div>

      {error && <div className="ai-error">{error}</div>}
      {success && <div className="ai-success">{success}</div>}

      {recipe && (
        <div className="ai-recipe">
          <h4>{recipe.name || "AI recept"}</h4>

          <div className="ai-meta">
            {typeof recipe.servings === "number" && (
              <span>Adag: {recipe.servings}</span>
            )}
            {typeof recipe.time_minutes === "number" && (
              <span>Idő: {recipe.time_minutes} perc</span>
            )}
          </div>

          <div className="ai-section">
            <strong>Hozzávalók</strong>
            <ul>
              {(recipe.ingredients || []).map((ing, i) => (
                <li key={i}>
                  <span className="amount-highlight">
                    {ing.amount} {ing.unit}
                  </span>{" "}
                  - {ing.name}
                </li>
              ))}
            </ul>
          </div>

          <div className="ai-section">
            <strong>Elkészítés</strong>
            <ol>
              {(recipe.steps || []).map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>

          <button onClick={handleSaveRecipe} disabled={savingRecipe}>
            {savingRecipe
              ? "Mentés..."
              : "AI-recept hozzáadás a saját receptjeim közé"}
          </button>
        </div>
      )}
    </div>
  );
}
