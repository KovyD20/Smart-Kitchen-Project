import { useState } from "react";
import "./NewRecipeForm.css";

const UNITS = ["g", "dkg", "kg", "ml", "dl", "l", "db"];

export default function NewRecipeForm({
  onRecipeCreated,
  existingTags,
  onAddTag,
}) {
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState([
    { name: "", amount: "", unit: "g" },
  ]);
  const [steps, setSteps] = useState([""]);
  const [selectedTags, setSelectedTags] = useState([]);
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

    const recipe = {
      name,
      ingredients,
      steps,
      tags: selectedTags,
    };

    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recipe),
    });

    const saved = await res.json();
    onRecipeCreated(saved);

    setName("");
    setIngredients([{ name: "", amount: "", unit: "g" }]);
    setSteps([""]);
    setSelectedTags([]);
    setNewTag("");
  };

  return (
    <div>
      <h3>Új recept</h3>

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
        </div>
      ))}
      <button onClick={addIngredient}>+ hozzávaló</button>

      <h4>Lépések</h4>
      {steps.map((step, i) => (
        <textarea
          tabIndex={5 + i}
          key={i}
          className="step-textarea"
          placeholder={`${i + 1}. lépés`}
          value={step}
          onChange={(e) => {
            const copy = [...steps];
            copy[i] = e.target.value;
            setSteps(copy);
          }}
        />
      ))}
      <button onClick={addStep}>+ lépés</button>

      <h4>Címkék</h4>

      <div>
        {existingTags.map((tag) => (
          <label key={tag} style={{ display: "block" }}>
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
          </label>
        ))}
      </div>

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
            prev.includes(tag) ? prev : [...prev, tag]
          );

          setNewTag("");
        }}
      >
        + címke
      </button>

      <button onClick={submit}>Mentés</button>
    </div>
  );
}
