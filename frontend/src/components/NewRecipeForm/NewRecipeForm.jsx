import { useEffect, useMemo, useRef, useState } from "react";
import "./NewRecipeForm.css";
import Icon from "../Icon/Icon";
import { SYSTEM_UNITS } from "../../constants/units";
import {
  ACCEPTED_TYPES,
  IMAGE_ERROR,
  validateImageFile,
} from "../../lib/imageUpload";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";

const UNITS = SYSTEM_UNITS;

const emptyIngredient = () => ({ name: "", amount: "", unit: "g" });

// The validator returns a code so the wording stays here, next to the UI that
// shows it. An unlisted code should be impossible, hence the generic fallback.
const IMAGE_ERROR_TEXT = {
  [IMAGE_ERROR.TYPE]: "Csak képfájlt lehet feltölteni",
  [IMAGE_ERROR.SIZE]: "A kép túl nagy (max. 15 MB)",
  [IMAGE_ERROR.DECODE]: "Ezt a képformátumot a böngésző nem tudja megnyitni",
  [IMAGE_ERROR.TOO_BIG_ENCODED]: "A képet nem sikerült elég kicsire tömöríteni",
};

const imageErrorText = (code) =>
  IMAGE_ERROR_TEXT[code] || "A képet nem sikerült betölteni";

// Drag & drop plus a file picker over one hidden input, with a preview of
// whichever image currently applies: a freshly picked file, or the one already
// on the recipe until it is explicitly cleared.
function ImagePicker({ previewUrl, hasImage, disabled, onPick, onClear }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files) => {
    const file = files?.[0];
    if (file) onPick(file);
  };

  return (
    <section className="rform-section">
      <span className="rform-label">Kép (opcionális)</span>

      <div
        className={`rform-image${dragging ? " is-dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer?.files);
        }}
      >
        {previewUrl ? (
          <img className="rform-image-preview" src={previewUrl} alt="A recept képe" />
        ) : (
          <span className="rform-image-empty">
            <Icon name="bowl" size={22} />
          </span>
        )}

        <div className="rform-image-actions">
          <p className="rform-image-hint">
            Húzd ide a képet, vagy válaszd ki. A feltöltés előtt automatikusan
            kisebbre méretezzük.
          </p>
          <div className="rform-row">
            <button
              type="button"
              className="rform-add"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <Icon name="plus" size={11} />
              {hasImage ? "Kép cseréje" : "Kép választása"}
            </button>
            {hasImage && (
              <button
                type="button"
                className="rform-add rform-image-clear"
                disabled={disabled}
                onClick={onClear}
              >
                <Icon name="trash" size={11} />
                Kép törlése
              </button>
            )}
          </div>
        </div>

        <input
          ref={inputRef}
          className="rform-image-input"
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={(e) => {
            handleFiles(e.target.files);
            // Let the same file be picked again after a clear.
            e.target.value = "";
          }}
        />
      </div>
    </section>
  );
}

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

  // Three-way image state: a newly picked File wins, otherwise the recipe's
  // existing URL applies unless it was explicitly cleared.
  const [imageFile, setImageFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);

  // Derived rather than held in state, so picking a file does not cost a second
  // render pass. An object URL is a live handle, not a string, so the effect
  // exists purely to release it -- otherwise the blob stays in memory for as
  // long as the page lives.
  const localPreview = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile],
  );

  useEffect(
    () => () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    },
    [localPreview],
  );

  const existingImage = removeImage ? null : recipe?.imageUrl || null;
  const previewUrl = localPreview || existingImage;

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
        await onSave({ ...data, id: recipe.id }, { imageFile, removeImage });
        return;
      }

      await onCreate?.(data, { imageFile });

      setName("");
      setIngredients([emptyIngredient()]);
      setSteps([""]);
      setSelectedTags([]);
      setNewTag("");
      setServings("");
      setTime("");
      setImageFile(null);
      setRemoveImage(false);
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

      <ImagePicker
        previewUrl={previewUrl}
        hasImage={Boolean(previewUrl)}
        disabled={saving}
        onPick={(file) => {
          const invalid = validateImageFile(file);
          if (invalid) {
            showToast(imageErrorText(invalid), "error");
            return;
          }
          setImageFile(file);
          setRemoveImage(false);
        }}
        onClear={() => {
          setImageFile(null);
          // Only an image already stored on the recipe needs deleting; dropping a
          // not-yet-uploaded pick is just local state.
          setRemoveImage(Boolean(recipe?.imageUrl));
        }}
      />

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
        {saving
          ? imageFile
            ? "Kép feltöltése…"
            : "Mentés…"
          : editMode
            ? "Módosítások mentése"
            : "Recept mentése"}
      </button>
    </div>
  );
}
