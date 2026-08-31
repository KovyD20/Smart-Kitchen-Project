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

// The amount cell, when the row is editable. Typing is local; Firestore is
// written on blur or Enter, so one edit costs one write instead of one per
// keystroke -- and a half-typed "1" on the way to "150" never lands as the real
// amount. Escape abandons the edit.
function AmountField({ value, onCommit, onDone }) {
  const [draft, setDraft] = useState(null);

  const commit = () => {
    if (draft === null) return;
    const next = Number(draft);
    setDraft(null);
    if (!Number.isFinite(next) || next <= 0 || next === Number(value)) return;
    onCommit(next);
  };

  return (
    <input
      className="item-qty-input"
      type="number"
      min="0"
      step="any"
      aria-label="Mennyiség"
      // The field only exists because the user just pressed the edit button, so
      // it is what they want the caret in.
      autoFocus
      // draft ?? value: while nothing is being typed the row follows Firestore,
      // so the +/- buttons and another device's edit both show up live.
      value={draft ?? String(value ?? "")}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        // Committed here rather than by blurring the field: Enter should write
        // even when the row is being driven without focus, and the blur that
        // follows is then a no-op because the draft is already cleared.
        if (e.key === "Enter") {
          commit();
          onDone?.();
        } else if (e.key === "Escape") {
          setDraft(null);
          onDone?.();
        }
      }}
    />
  );
}

// One inventory line: optional bought-checkbox, thumbnail, name (with an
// optional secondary note under it), −/qty/+ stepper, delete.
//
// The amount reads as plain text ("2 dl") until the row's own pencil is pressed,
// which swaps that one row -- not the list -- for an amount field and a unit
// picker. A dozen rows of inputs would turn a shopping list into a form, and the
// amount is read far more often than it is corrected.
//
// Editing exists only when the caller passes the matching handler; without them
// the pencil is not rendered at all.
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
  amount,
  unit,
  units,
  onAmountChange,
  onUnitChange,
  note,
  done,
  onToggleDone,
  onIncrement,
  onDecrement,
  onDelete,
  disableDecrement,
}) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const thumbSrc = showThumb ? pantryImageUrl({ nameKey, imageUrl }) : null;

  const canEdit = Boolean(onAmountChange || onUnitChange);
  // Guarded by canEdit as well: a row can lose its handlers between renders
  // (a read-only list), and it must not be left stuck showing inputs.
  const isEditing = canEdit && editing;

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
        {isEditing && onAmountChange ? (
          <AmountField
            value={amount}
            onCommit={onAmountChange}
            onDone={() => setEditing(false)}
          />
        ) : (
          <span className="item-qty">{qtyLabel}</span>
        )}
        {isEditing && onUnitChange && (
          <select
            className="item-unit"
            aria-label="Mértékegység"
            value={unit}
            onChange={(e) => onUnitChange(e.target.value)}
          >
            {/* A unit already on the item but missing from the list (an older
                entry, or one the catalog seeded) still has to be selectable,
                otherwise the select would silently rewrite it on mount. */}
            {(units || []).includes(unit) ? null : (
              <option value={unit}>{unit}</option>
            )}
            {(units || []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="icon-btn"
          aria-label="Növelés"
          onClick={onIncrement}
        >
          <Icon name="plus" size={11} />
        </button>
      </div>

      {canEdit && (
        <button
          type="button"
          className={`icon-btn item-edit${isEditing ? " is-active" : ""}`}
          aria-label={`${name} mennyiségének módosítása`}
          aria-pressed={isEditing}
          onClick={() => setEditing((prev) => !prev)}
        >
          <Icon name={isEditing ? "check" : "pen"} size={11} />
        </button>
      )}

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
