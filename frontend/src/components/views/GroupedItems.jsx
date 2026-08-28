import { useState } from "react";
import Icon from "../Icon/Icon";
import ColorPicker from "../ColorPicker/ColorPicker";
import { pantryImageUrl } from "../../lib/pantryImages";

// One control for every card at once, instead of clicking through a dozen headers.
// A single button rather than a pair: its label names the action it will perform,
// which is unambiguous even when the cards are in mixed states (anything closed ->
// expanding is what the user wants next).
export function CollapseAllToggle({ keys, anyClosed, onOpenAll, onCloseAll }) {
  if (!keys || keys.length === 0) return null;

  const willExpand = anyClosed(keys);

  return (
    <button
      type="button"
      className="btn-pill btn-outline btn-outline-neutral collapse-all"
      onClick={() => (willExpand ? onOpenAll() : onCloseAll(keys))}
    >
      <Icon name={willExpand ? "chevronDown" : "chevronUp"} size={11} />
      {willExpand ? "Kategóriák kibontása" : "Kategóriák összecsukása"}
    </button>
  );
}

// Collapsible category card — the shared shape behind the shopping list and the
// fridge in the design (accent stripe on the left, count on the right).
//
// The colour dot only appears when the caller passes onColorChange. It has to sit
// beside the header rather than inside it: the header is itself a <button>, and a
// button cannot contain another one.
export function GroupCard({
  accent,
  category,
  meta,
  open,
  onToggle,
  onColorChange,
  onColorReset,
  isCustomColor,
  children,
}) {
  const [picking, setPicking] = useState(false);

  return (
    <div className="group-card" style={{ "--accent": accent }}>
      <div className="group-head-row">
        <button
          type="button"
          className="group-head"
          aria-expanded={open}
          onClick={onToggle}
        >
          <span className="group-name">{category}</span>
          <span className="group-meta">{meta}</span>
          <Icon
            name={open ? "chevronUp" : "chevronDown"}
            size={11}
            color="#7d7d7d"
          />
        </button>

        {onColorChange && (
          <button
            type="button"
            className="group-color"
            aria-label={`${category} színének módosítása`}
            aria-expanded={picking}
            onClick={() => setPicking((prev) => !prev)}
          >
            <span className="group-color-dot" />
          </button>
        )}
      </div>

      {picking && (
        <ColorPicker
          category={category}
          value={accent}
          isCustom={Boolean(isCustomColor)}
          onSelect={(hex) => {
            onColorChange(hex);
            setPicking(false);
          }}
          onReset={() => {
            onColorReset?.();
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}

      {open && <div className="group-body">{children}</div>}
    </div>
  );
}

// One inventory line: optional bought-checkbox, thumbnail, name (with an
// optional secondary note under it), −/qty/+ stepper, delete.
//
// The thumbnail is opportunistic: `pantryImageUrl` builds a conventional path
// without knowing whether the file exists, and a load failure drops the <img>
// entirely rather than leaving an empty slot — so a partially filled asset set
// costs nothing in rows it does not cover.
export function ItemRow({
  name,
  nameKey,
  imageUrl,
  showThumb = true,
  qtyLabel,
  note,
  done,
  onToggleDone,
  onIncrement,
  onDecrement,
  onDelete,
  disableDecrement,
}) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const thumbSrc = showThumb ? pantryImageUrl({ nameKey, imageUrl }) : null;

  return (
    <div className="item-row">
      {onToggleDone && (
        <button
          type="button"
          className={`item-check${done ? " is-done" : ""}`}
          aria-pressed={Boolean(done)}
          aria-label={`${name} megvéve`}
          onClick={onToggleDone}
        >
          <Icon name="check" size={11} />
        </button>
      )}

      {thumbSrc && !thumbFailed && (
        <img
          className="item-thumb"
          src={thumbSrc}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          onError={() => setThumbFailed(true)}
        />
      )}

      <div className="item-label">
        <span className={`item-name${done ? " is-done" : ""}`}>{name}</span>
        {note && <span className="item-note">{note}</span>}
      </div>

      <div className="item-stepper">
        <button
          type="button"
          className="icon-btn"
          aria-label="Csökkentés"
          disabled={disableDecrement}
          onClick={onDecrement}
        >
          <Icon name="minus" size={11} />
        </button>
        <span className="item-qty">{qtyLabel}</span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Növelés"
          onClick={onIncrement}
        >
          <Icon name="plus" size={11} />
        </button>
      </div>

      <button
        type="button"
        className="icon-btn danger"
        aria-label={`${name} törlése`}
        onClick={onDelete}
      >
        <Icon name="trash" size={11} />
      </button>
    </div>
  );
}

// Dashed inline "Tétel hozzáadása" row.
export function AddItemRow({ units, onAdd }) {
  const [draft, setDraft] = useState({ name: "", amount: "", unit: "db" });

  const submit = () => {
    const name = draft.name.trim();
    const amount = Number(draft.amount);
    if (!name || !Number.isFinite(amount) || amount <= 0) return;
    onAdd({ name, amount, unit: draft.unit || "db" });
    setDraft({ name: "", amount: "", unit: "db" });
  };

  return (
    <div className="add-item">
      <Icon name="plus" size={12} color="#7a7a7a" />
      <input
        className="add-name"
        placeholder="Tétel hozzáadása"
        value={draft.name}
        onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <input
        className="add-amount"
        type="number"
        min="0"
        step="1"
        placeholder="menny."
        value={draft.amount}
        onChange={(e) => setDraft((p) => ({ ...p, amount: e.target.value }))}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <select
        value={draft.unit}
        aria-label="Mértékegység"
        onChange={(e) => setDraft((p) => ({ ...p, unit: e.target.value }))}
      >
        {units.map((unit) => (
          <option key={unit} value={unit}>
            {unit}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="icon-btn"
        aria-label="Hozzáadás"
        onClick={submit}
      >
        <Icon name="plus" size={12} />
      </button>
    </div>
  );
}
