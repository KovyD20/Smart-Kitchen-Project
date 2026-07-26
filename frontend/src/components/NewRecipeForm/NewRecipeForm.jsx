import { useState } from "react";
import "./NewRecipeForm.css";
import { SYSTEM_UNITS } from "../../constants/units";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";

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

  const [servings, setServings] = useState(recipe?.servings ?? "");
  const [time, setTime] = useState(recipe?.time ?? recipe?.time_minutes ?? "");

  const { showToast } = useToast();
  const confirm = useConfirm();

  const addIngredient = () =>
    setIngredients([...ingredients, { name: "", amount: "", unit: "g" }]);

  const addStep = () => setSteps([...steps, ""]);

  const submit = async () => {
    if (!name.trim()) {
      showToast("A recept neve kötelező", "error");
      return;
    }

    if (
      ingredients.length === 0 ||
      ingredients.some((i) => !i.name.trim() || Number(i.amount) <= 0)
    ) {
      showToast("Hozzávalók hibásak", "error");
      return;
    }

    if (steps.length === 0 || steps.some((s) => !s.trim())) {
      showToast("Lépések hiányosak", "error");
      return;
    }

    const parsedServings = Number(servings);
    const parsedTime = Number(time);

    const data = {
      name,
      ingredients,
      steps,
      tags: selectedTags,
      ...(Number.isFinite(parsedServings) && parsedServings > 0
        ? { servings: parsedServings }
        : {}),
      ...(Number.isFinite(parsedTime) && parsedTime > 0
        ? { time: parsedTime }
        : {}),
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
    setServings("");
    setTime("");
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
                !(await confirm(
                  `Biztosan törlöd a "${tag}" címkét minden receptből?`,
                ))
              )
                return;

              if (onDeleteTag) {
                await onDeleteTag(tag);
                await onRecipeCreated?.();
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

      <input
        tabIndex={6}
        type="number"
        placeholder="Adagok száma (opcionális)"
        value={servings}
        min="1"
        onChange={(e) => setServings(e.target.value)}
      />

      <input
        tabIndex={7}
        type="number"
        placeholder="Elkészítési idő (perc, opcionális)"
        value={time}
        min="1"
        onChange={(e) => setTime(e.target.value)}
      />

      <button onClick={submit}>Recept mentése💾</button>
    </div>
  );
}
