import { useState } from "react";
import Icon from "../Icon/Icon";

// Collapsible category card — the shared shape behind the shopping list and the
// fridge in the design (accent stripe on the left, count on the right).
export function GroupCard({ accent, category, meta, open, onToggle, children }) {
  return (
    <div className="group-card" style={{ "--accent": accent }}>
      <button
        type="button"
        className="group-head"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="group-name">{category}</span>
        <span className="group-meta">{meta}</span>
        <Icon name={open ? "chevronUp" : "chevronDown"} size={11} color="#7d7d7d" />
      </button>
      {open && <div className="group-body">{children}</div>}
    </div>
  );
}

// One inventory line: optional bought-checkbox, name, −/qty/+ stepper, delete.
export function ItemRow({
  name,
  qtyLabel,
  done,
  onToggleDone,
  onIncrement,
  onDecrement,
  onDelete,
  disableDecrement,
}) {
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

      <span className={`item-name${done ? " is-done" : ""}`}>{name}</span>

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
