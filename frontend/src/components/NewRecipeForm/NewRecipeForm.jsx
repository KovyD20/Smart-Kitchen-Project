import { useState } from "react";
import "./NewRecipeForm.css";
import { SYSTEM_UNITS } from "../../constants/units";

const UNITS = SYSTEM_UNITS;

export default function NewRecipeForm({
  onRecipeCreated,
  onCreate,
  onSave,
  existingTags,
  onAddTag,
  onDeleteTag,
  editMode = false,
  recipe,
}) {
  const [name, setName] = useState(recipe?.name || "");
  const [ingredients, setIngredients] = useState(
    recipe?.ingredients || [{ name: "", amount: "", unit: "g" }],
  );
  const [steps, setSteps] = useState(recipe?.steps || [""]);
  const [selectedTags, setSelectedTags] = useState(recipe?.tags || []);
  const [newTag, setNewTag] = useState("");

  const addIngredient = () =>
    setIngredients([...ingredients, { name: "", amount: "", unit: "g" }]);

  const addStep = () => setSteps([...steps, ""]);

  const submit = async () => {
    if (!name.trim()) return alert("A recept neve kötelező");

    if (
      ingredients.length === 0 ||
      ingredients.some((i) => !i.name.trim() || Number(i.amount) <= 0)
    ) {
      return alert("Hozzávalók hibásak");
    }

    if (steps.length === 0 || steps.some((s) => !s.trim())) {
      return alert("Lépések hiányosak");
    }

    const data = {
      name,
      ingredients,
      steps,
      tags: selectedTags,
    };

    if (editMode) {
      await onSave({ ...data, id: recipe.id });
      return;
    }
    if (onCreate) {
      await onCreate(data);
    }
    await onRecipeCreated?.();

    setName("");
    setIngredients([{ name: "", amount: "", unit: "g" }]);
    setSteps([""]);
    setSelectedTags([]);
    setNewTag("");
  };

  return (
    <div className={editMode ? "recipe-details" : ""}>
      <h3>{editMode ? "Recept szerkesztése" : "Új recept"}</h3>

      <input
        tabIndex={1}
        placeholder="Recept neve"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <h4>Hozzávalók</h4>
      {ingredients.map((ing, i) => (
        <div key={i}>
          <input
            tabIndex={2}
            placeholder="Név"
            value={ing.name}
            onChange={(e) => {
              const copy = [...ingredients];
              copy[i].name = e.target.value;
              setIngredients(copy);
            }}
          />

          <input
            tabIndex={3}
            type="number"
            className="amount-input"
            placeholder="Mennyiség"
            value={ing.amount}
            min="0"
            onChange={(e) => {
              const copy = [...ingredients];
              copy[i].amount = e.target.value;
              setIngredients(copy);
            }}
          />
          <select
            tabIndex={4}
            value={ing.unit}
            onChange={(e) => {
              const copy = [...ingredients];
              copy[i].unit = e.target.value;
              setIngredients(copy);
            }}
          >
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>

                    <button
            type="button"
            onClick={() =>
              setIngredients((prev) => prev.filter((_, index) => index !== i))
            }
          >
          ❌
          </button>
        </div>
      ))}
      <button onClick={addIngredient}>➕ hozzávaló</button>

      <h4>Lépések</h4>
      {steps.map((step, i) => (
        <div key={i} style={{ position: "relative" }}>
          <textarea
            tabIndex={5 + i}
            className="step-textarea"
            placeholder={`${i + 1}. lépés`}
            value={step}
            onChange={(e) => {
              const copy = [...steps];
              copy[i] = e.target.value;
              setSteps(copy);
            }}
          />
                      <div></div>

          <button
            type="button"
            onClick={() =>
              setSteps((prev) => prev.filter((_, index) => index !== i))
            }
          >
            Lépés törlése❌
          </button>
        </div>
      ))}
      <button onClick={addStep}>➕ lépés</button>

      <h4>Címkék</h4>

      {existingTags.map((tag) => (
        <label
          key={tag}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <input
            type="checkbox"
            checked={selectedTags.includes(tag)}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedTags([...selectedTags, tag]);
              } else {
                setSelectedTags(selectedTags.filter((t) => t !== tag));
              }
            }}
          />
          {tag}
          <button
            type="button"
            style={{ marginLeft: "auto" }}
            onClick={async () => {
              if (
                !window.confirm(
                  `Biztosan törlöd a "${tag}" címkét minden receptből?`,
                )
              )
                return;

              if (onDeleteTag) {
                await onDeleteTag(tag);
                await onRecipeCreated?.();
                return;
              }

              const res = await fetch(`/api/recipes/tags/${tag}`, {
                method: "DELETE",
              });

              if (res.ok) {
                await onRecipeCreated?.();
              } else {
                alert("Hiba történt a címke törlésekor");
              }
            }}
          >
            ❌
          </button>
        </label>
      ))}

      <input
        placeholder="Új címke"
        value={newTag}
        onChange={(e) => setNewTag(e.target.value)}
      />

      <button
        onClick={() => {
          const tag = newTag.trim();
          if (!tag) return;

          onAddTag(tag);

          setSelectedTags((prev) =>
            prev.includes(tag) ? prev : [...prev, tag],
          );

          setNewTag("");
        }}
      >
        ➕ címke
      </button>
      <div></div>

      <button onClick={submit}>Recept mentése💾</button>
    </div>
  );
}
