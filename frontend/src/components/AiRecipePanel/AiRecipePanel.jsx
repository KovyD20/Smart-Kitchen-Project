import { useState } from "react";
import { authedFetch } from "../../lib/api";
import { aiErrorMessage } from "../../lib/aiErrors";
import Icon from "../Icon/Icon";
import {
  cleanIngredient,
  formatAmount,
  groupIngredients,
} from "../../lib/recipes";
import "./AiRecipePanel.css";

export default function AiRecipePanel({
  onSaveRecipe,
  fridgeItems = [],
  isMobile,
}) {
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

  const normalizeRecipe = (raw) => {
    if (!raw || typeof raw !== "object") return null;

    const baseServings =
      Number.isFinite(Number(raw.servings)) && Number(raw.servings) > 0
        ? Number(raw.servings)
        : 1;

    const normalizedIngredients = Array.isArray(raw.ingredients)
      ? raw.ingredients.map((ingredient) => {
          const amount = Number(ingredient?.amount);
          return {
            ...ingredient,
            _baseAmount: Number.isFinite(amount) ? amount : ingredient?.amount,
          };
        })
      : [];

    return {
      ...raw,
      servings: baseServings,
      _baseServings: baseServings,
      ingredients: normalizedIngredients,
      time: raw.time ?? raw.time_minutes ?? "",
    };
  };

  const scaleRecipe = (newServings) => {
    setRecipe((prev) => {
      if (!prev) return prev;
      const baseServings = Number(prev._baseServings) || 1;
      const targetServings = Math.max(1, Number(newServings) || baseServings);
      const nextIngredients = (prev.ingredients || []).map((ingredient) => {
        const baseAmount = Number(ingredient._baseAmount);
        if (!Number.isFinite(baseAmount)) return ingredient;
        return {
          ...ingredient,
          amount: formatAmount((baseAmount * targetServings) / baseServings),
        };
      });

      return {
        ...prev,
        servings: targetServings,
        ingredients: nextIngredients,
      };
    });
  };

  const handleRecipeByName = async () => {
    const name = nameInput.trim();
    if (!name) return;

    clearError();
    clearSuccess();
    setRecipe(null);
    setLoadingName(true);

    try {
      const res = await authedFetch("/api/ai/recipe-by-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(aiErrorMessage(res.status, data));
        return;
      }

      setRecipe(normalizeRecipe(data.recipe));
    } catch {
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
      const res = await authedFetch("/api/ai/suggest-from-fridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: fridgeItems }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(aiErrorMessage(res.status, data));
        return;
      }

      const nextOptions = Array.isArray(data.options) ? data.options : [];
      setOptions(nextOptions);
      setSelectedOption(nextOptions[0] || "");
    } catch {
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
      const res = await authedFetch("/api/ai/recipe-from-fridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, items: fridgeItems }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(aiErrorMessage(res.status, data));
        return;
      }

      setRecipe(normalizeRecipe(data.recipe));
    } catch {
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

    const parsedServings = Number(recipe.servings);
    const parsedTime = Number(recipe.time ?? recipe.time_minutes);

    const payload = {
      name: recipe.name,
      ingredients: Array.isArray(recipe.ingredients)
        ? recipe.ingredients.map(({ _baseAmount, ...ingredient }) =>
            cleanIngredient(ingredient),
          )
        : [],
      steps: Array.isArray(recipe.steps) ? recipe.steps : [],
      tags: Array.isArray(recipe.tags) ? recipe.tags : [],
      ...(Number.isFinite(parsedServings) && parsedServings > 0
        ? { servings: parsedServings }
        : {}),
      ...(Number.isFinite(parsedTime) && parsedTime > 0 ? { time: parsedTime } : {}),
    };

    try {
      if (!onSaveRecipe) {
        setError("Mentés nem elérhető");
        return;
      }

      await onSaveRecipe(payload);
      setSuccess("AI-recept elmentve a saját receptjeid közé");
      setRecipe(null);
    } catch {
      setError("Mentés sikertelen");
    } finally {
      setSavingRecipe(false);
    }
  };

  return (
    <>
      <div className="new-card new-card-ai" style={{ "--accent": "var(--orange)", "--accent-fg": "#231404" }}>
        <div className="new-card-ai-head">
          <Icon name="wand" size={14} color="var(--orange)" />
          <span className="panel-title">AI-recept generálás</span>
        </div>

        <span className="new-card-icon">
          <Icon name="wand" size={17} />
        </span>
        <span className="new-card-title">AI-recept generálás</span>

        <input
          className="field"
          placeholder="Recept neve (pl. gulyásleves)"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRecipeByName()}
        />

        <button
          type="button"
          className="btn-pill btn-solid"
          disabled={loadingName || !nameInput.trim()}
          onClick={handleRecipeByName}
        >
          {loadingName ? "Generálás…" : "Generálás név alapján"}
        </button>

        <button
          type="button"
          className="btn-pill btn-outline"
          style={{ "--accent": "var(--blue)" }}
          disabled={loadingOptions}
          onClick={handleSuggestFromFridge}
        >
          <Icon name="snowflake" size={13} />
          {loadingOptions
            ? "Keresés…"
            : `Ötletek a hűtőből (${fridgeItems.length} tétel)`}
        </button>

        {isMobile && (
          <div className="ai-hint">
            A hűtőben most {fridgeItems.length} tétel van — ezekből állít össze
            recepteket.
          </div>
        )}

        {options.length > 0 && (
          <div className="ai-options">
            <div className="ai-options-title">AI választásai</div>
            {options.map((option) => (
              <label key={option} className="ai-option">
                <input
                  type="radio"
                  name="ai-option"
                  value={option}
                  checked={selectedOption === option}
                  onChange={() => setSelectedOption(option)}
                />
                <span>{option}</span>
              </label>
            ))}
            <button
              type="button"
              className="btn-pill btn-solid"
              disabled={loadingFridgeRecipe || !selectedOption}
              onClick={handleRecipeFromFridge}
            >
              {loadingFridgeRecipe ? "Generálás…" : "Recept a hűtőből"}
            </button>
          </div>
        )}

        {error && <div className="ai-error">{error}</div>}
        {success && <div className="ai-success">{success}</div>}
      </div>

      {recipe && (
        <section className="ai-result panel" style={{ "--accent": "var(--orange)" }}>
          <header className="panel-head">
            <Icon name="wand" size={14} color="var(--orange)" />
            <span className="panel-title">{recipe.name}</span>
            <span className="ai-result-meta">
              {recipe.servings} adag
              {recipe.time ? ` · ${recipe.time} perc` : ""}
            </span>
          </header>

          <div className="ai-result-body">
            <div className="ai-result-col">
              <div className="ai-result-label">Hozzávalók</div>
              {/* Same sectioning as the saved recipe, so the preview shows
                  everything the save is about to store. */}
              {groupIngredients(recipe.ingredients).map((block, blockIndex) => (
                <div key={blockIndex} className="ing-group">
                  {block.group && (
                    <div className="ing-group-label">{block.group}</div>
                  )}
                  {block.items.map((ingredient, i) => (
                    <div key={i} className="ing-row">
                      <span className="ing-qty">
                        {ingredient.amount} {ingredient.unit}
                      </span>
                      <span className="ing-name">
                        {ingredient.name}
                        {ingredient.note?.trim() && (
                          <span className="ing-note">{ingredient.note.trim()}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="ai-result-col">
              <div className="ai-result-label">Elkészítés</div>
              {(recipe.steps || []).map((step, i) => (
                <div key={i} className="step-row">
                  <span className="step-n">{i + 1}</span>
                  <span className="step-text">{step}</span>
                </div>
              ))}
            </div>
          </div>

          <footer className="ai-result-foot">
            <div className="servings">
              <button
                type="button"
                className="icon-btn"
                aria-label="Kevesebb adag"
                disabled={recipe.servings <= 1}
                onClick={() => scaleRecipe((recipe.servings || 1) - 1)}
              >
                <Icon name="minus" size={11} />
              </button>
              <span className="servings-value">{recipe.servings} adag</span>
              <button
                type="button"
                className="icon-btn"
                aria-label="Több adag"
                onClick={() => scaleRecipe((recipe.servings || 1) + 1)}
              >
                <Icon name="plus" size={11} />
              </button>
            </div>
            <div className="view-spacer" />
            <button
              type="button"
              className="btn-pill btn-solid"
              disabled={savingRecipe}
              onClick={handleSaveRecipe}
            >
              <Icon name="save" size={13} />
              {savingRecipe ? "Mentés…" : "Mentés a receptjeim közé"}
            </button>
          </footer>
        </section>
      )}
    </>
  );
}
