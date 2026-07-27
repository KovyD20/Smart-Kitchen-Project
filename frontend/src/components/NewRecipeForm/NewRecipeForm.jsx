import { useState } from "react";
import "./NewRecipeForm.css";
import Icon from "../Icon/Icon";
import { SYSTEM_UNITS } from "../../constants/units";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";

const UNITS = SYSTEM_UNITS;

const emptyIngredient = () => ({ name: "", amount: "", unit: "g" });

export default function NewRecipeForm({
  onCreate,
  onSave,
  existingTags = [],
  onAddTag,
  onDeleteTag,
  editMode = false,
  recipe,
}) {
  const [name, setName] = useState(recipe?.name || "");
  const [ingredients, setIngredients] = useState(
    recipe?.ingredients?.length ? recipe.ingredients : [emptyIngredient()],
  );
  const [steps, setSteps] = useState(recipe?.steps?.length ? recipe.steps : [""]);
  const [selectedTags, setSelectedTags] = useState(recipe?.tags || []);
  const [newTag, setNewTag] = useState("");
  const [servings, setServings] = useState(recipe?.servings ?? "");
  const [time, setTime] = useState(recipe?.time ?? recipe?.time_minutes ?? "");
  const [saving, setSaving] = useState(false);

  const { showToast } = useToast();
  const confirm = useConfirm();

  const patchIngredient = (index, field, value) =>
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)),
    );

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
      ...(Number.isFinite(parsedTime) && parsedTime > 0 ? { time: parsedTime } : {}),
    };

    setSaving(true);
    try {
      if (editMode) {
        await onSave({ ...data, id: recipe.id });
        return;
      }

      await onCreate?.(data);

      setName("");
      setIngredients([emptyIngredient()]);
      setSteps([""]);
      setSelectedTags([]);
      setNewTag("");
      setServings("");
      setTime("");
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    const tag = newTag.trim();
    if (!tag) return;
    onAddTag?.(tag);
    setSelectedTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setNewTag("");
  };

  return (
    <div className="rform">
      <label className="rform-field">
        <span className="rform-label">Recept neve</span>
        <input
          className="field field-neutral"
          placeholder="pl. Négysajtos gnocchi"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <section className="rform-section">
        <div className="rform-section-head">
          <span className="rform-label">Hozzávalók</span>
          <button
            type="button"
            className="rform-add"
            onClick={() => setIngredients((prev) => [...prev, emptyIngredient()])}
          >
            <Icon name="plus" size={11} />
            Hozzávaló
          </button>
        </div>

        {ingredients.map((ing, i) => (
          <div key={i} className="rform-ing">
            <input
              className="field field-neutral rform-ing-name"
              placeholder="Név"
              value={ing.name}
              onChange={(e) => patchIngredient(i, "name", e.target.value)}
            />
            <input
              className="field field-neutral rform-ing-amount"
              type="number"
              min="0"
              placeholder="Menny."
              value={ing.amount}
              onChange={(e) => patchIngredient(i, "amount", e.target.value)}
            />
            <select
              className="field field-neutral rform-ing-unit"
              aria-label="Mértékegység"
              value={ing.unit}
              onChange={(e) => patchIngredient(i, "unit", e.target.value)}
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="icon-btn danger rform-remove"
              aria-label="Hozzávaló törlése"
              onClick={() =>
                setIngredients((prev) => prev.filter((_, index) => index !== i))
              }
            >
              <Icon name="trash" size={12} />
            </button>
          </div>
        ))}
      </section>

      <section className="rform-section">
        <div className="rform-section-head">
          <span className="rform-label">Lépések</span>
          <button
            type="button"
            className="rform-add"
            onClick={() => setSteps((prev) => [...prev, ""])}
          >
            <Icon name="plus" size={11} />
            Lépés
          </button>
        </div>

        {steps.map((step, i) => (
          <div key={i} className="rform-step">
            <span className="step-n">{i + 1}</span>
            <textarea
              className="field field-neutral rform-textarea"
              placeholder={`${i + 1}. lépés`}
              value={step}
              onChange={(e) =>
                setSteps((prev) =>
                  prev.map((s, index) => (index === i ? e.target.value : s)),
                )
              }
            />
            <button
              type="button"
              className="icon-btn danger rform-remove"
              aria-label="Lépés törlése"
              onClick={() =>
                setSteps((prev) => prev.filter((_, index) => index !== i))
              }
            >
              <Icon name="trash" size={12} />
            </button>
          </div>
        ))}
      </section>

      <section className="rform-section">
        <span className="rform-label">Címkék</span>

        <div className="rform-tags">
          {existingTags.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <span key={tag} className={`rform-tag${active ? " is-active" : ""}`}>
                <button
                  type="button"
                  className="rform-tag-toggle"
                  aria-pressed={active}
                  onClick={() =>
                    setSelectedTags((prev) =>
                      active ? prev.filter((t) => t !== tag) : [...prev, tag],
                    )
                  }
                >
                  {tag}
                </button>
                <button
                  type="button"
                  className="rform-tag-del"
                  aria-label={`${tag} címke törlése minden receptből`}
                  onClick={async () => {
                    if (
                      !(await confirm(
                        `Biztosan törlöd a "${tag}" címkét minden receptből?`,
                      ))
                    )
                      return;
                    setSelectedTags((prev) => prev.filter((t) => t !== tag));
                    await onDeleteTag?.(tag);
                  }}
                >
                  <Icon name="xmark" size={9} />
                </button>
              </span>
            );
          })}
        </div>

        <div className="rform-row">
          <input
            className="field field-neutral"
            placeholder="Új címke"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
          />
          <button type="button" className="rform-add" onClick={addTag}>
            <Icon name="plus" size={11} />
            Címke
          </button>
        </div>
      </section>

      <div className="rform-row">
        <label className="rform-field">
          <span className="rform-label">Adagok száma (opcionális)</span>
          <input
            className="field field-neutral"
            type="number"
            min="1"
            placeholder="pl. 4"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
          />
        </label>
        <label className="rform-field">
          <span className="rform-label">Elkészítési idő, perc (opcionális)</span>
          <input
            className="field field-neutral"
            type="number"
            min="1"
            placeholder="pl. 25"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
      </div>

      <button
        type="button"
        className="btn-pill btn-solid rform-submit"
        disabled={saving}
        onClick={submit}
      >
        <Icon name="save" size={13} />
        {saving ? "Mentés…" : editMode ? "Módosítások mentése" : "Recept mentése"}
      </button>
    </div>
  );
}
