import { useRef, useState } from "react";
import Icon from "../Icon/Icon";
import { isPlainKey, isTypingTarget } from "../../lib/keyboard";
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

// Colour editing is a mode, not a per-card control. The dot sits in every card
// header, right where the thumb lands when scrolling a long list on a phone, so
// leaving it always live meant opening colour panels by accident. One switch for
// the whole view, off by default, and the dots go quiet.
//
// The dots stay visible while the mode is off: a dot is also what says a card's
// colour can be changed at all.
export function ColorEditToggle({ groupCount, active, onToggle }) {
  // Nothing to arm while no card is on screen.
  if (!groupCount) return null;

  return (
    <button
      type="button"
      // Two signals, no moving background: the tick says on or off outright, and
      // dropping the neutral override hands the pill the view's own accent
      // (yellow on the list, blue in the fridge) while it is armed.
      className={`btn-pill btn-outline${
        active ? "" : " btn-outline-neutral"
      } color-edit-toggle`}
      aria-pressed={active}
      onClick={onToggle}
    >
      <Icon name={active ? "check" : "xmark"} size={11} />
      Színek szerkesztése
    </button>
  );
}

// Collapsible category card — the shared shape behind the shopping list and the
// fridge in the design (accent stripe on the left, count on the right).
//
// The colour dot appears whenever the caller passes onColorChange, but it only
// reacts while colorEditing is on (see ColorEditToggle). It has to sit beside the
// header rather than inside it: the header is itself a <button>, and a button
// cannot contain another one.
export function GroupCard({
  accent,
  category,
  meta,
  open,
  onToggle,
  navProps,
  onColorChange,
  onColorReset,
  colorEditing,
  isCustomColor,
  children,
}) {
  const [picking, setPicking] = useState(false);

  const canPickColor = Boolean(onColorChange) && Boolean(colorEditing);
  // Leaving colour-edit mode closes the panel it opened — the dot that would
  // close it is disabled by then. It has to be reset rather than merely hidden,
  // or switching the mode back on would pop the panel open again on a card the
  // user has long since scrolled past.
  if (picking && !canPickColor) setPicking(false);

  return (
    <div className="group-card" style={{ "--accent": accent }}>
      <div className="group-head-row">
        {/* Arrow keys follow the treeview convention: they open and close the
            card only in the direction they point, so "close" on an already
            closed card does not reopen it. */}
        <button
          type="button"
          className="group-head"
          aria-expanded={open}
          onClick={onToggle}
          {...navProps}
          onKeyDown={(event) => {
            if (!isPlainKey(event)) return;
            if (event.key === "ArrowRight" && !open) {
              event.preventDefault();
              onToggle();
            } else if (event.key === "ArrowLeft" && open) {
              event.preventDefault();
              onToggle();
            }
          }}
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
            disabled={!canPickColor}
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

      {open && (
        <div className="group-body" role="list">
          {children}
        </div>
      )}
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
          // preventDefault so the layers above (the page-wide Escape/Enter
          // handling) treat the key as spent and leave the row alone.
          e.preventDefault();
          commit();
          onDone?.();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setDraft(null);
          onDone?.();
        }
      }}
    />
  );
}

// One inventory line: optional bought-checkbox, thumbnail, name (with an
// optional secondary note under it), the amount, and the pencil that opens it.
//
// Everything that changes the row -- the −/+ stepper, the amount field, the unit
// picker, the bin -- lives behind that pencil, and only the row whose pencil was
// pressed opens. Two reasons. A dozen rows of live inputs and buttons make a
// shopping list read as a form, when the amount is looked at far more often than
// it is corrected. And on a phone those controls were taking the width the name
// needed: "sajt (trappista / félkemény)" had nowhere to go but an ellipsis.
// Desktop follows the same rule instead of keeping a second layout -- one code
// path, and the keys below still adjust an amount without opening anything.
//
// Editing exists only when the caller passes the matching handler; without them
// the pencil is not rendered at all -- and then the stepper and the bin stay on
// show, since there would be nothing left to bring them back.
//
// Keyboard-wise the row is a single tab stop (see useListKeyboardNav): the inner
// buttons carry tabIndex={-1} and are driven by the row's own arrow/Space/Delete
// handling instead. Those keys work in both modes, so hiding the buttons costs
// the keyboard nothing. With the mouse nothing changes.
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
  navProps,
}) {
  const rowRef = useRef(null);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const thumbSrc = showThumb ? pantryImageUrl({ nameKey, imageUrl }) : null;

  const canEdit = Boolean(onAmountChange || onUnitChange);
  // Guarded by canEdit as well: a row can lose its handlers between renders
  // (a read-only list), and it must not be left stuck showing inputs.
  const isEditing = canEdit && editing;
  // The stepper and the bin are edit-mode controls -- but only on a row that has
  // a pencil to reveal them again. Without one they stay put, or a row with no
  // amount handlers would have no reachable way to delete itself.
  const showControls = isEditing || !canEdit;

  // Closing the amount field unmounts the input the caret is in, so the focus
  // has to be handed back explicitly -- otherwise it lands on <body> and the
  // row the user was working on is lost.
  const stopEditing = () => {
    setEditing(false);
    rowRef.current?.focus();
  };

  // Row-level shortcuts. `isTypingTarget` guards them because the amount field
  // lives inside the row: while it is open the arrows belong to the caret, and
  // Delete to the text, not to the item.
  const handleKeyDown = (event) => {
    if (isTypingTarget(event) || !isPlainKey(event)) return;

    const run = (handler) => {
      if (!handler) return;
      event.preventDefault();
      handler();
    };

    switch (event.key) {
      case "ArrowRight":
        run(onIncrement);
        break;
      case "ArrowLeft":
        if (!disableDecrement) run(onDecrement);
        break;
      case " ":
        run(onToggleDone);
        break;
      case "Delete":
      case "Backspace":
        run(onDelete);
        break;
      case "Enter":
        if (canEdit) {
          event.preventDefault();
          setEditing(true);
        }
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={rowRef}
      className={`item-row${isEditing ? " is-editing" : ""}`}
      role="listitem"
      aria-label={name}
      onKeyDown={handleKeyDown}
      {...navProps}
    >
      {onToggleDone && (
        <button
          type="button"
          className={`item-check${done ? " is-done" : ""}`}
          tabIndex={-1}
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

      {/* One box for the amount and everything that acts on it, so a phone can
          drop the whole group onto its own line while the row is open and give
          the name back the full width. */}
      <div className="item-controls">
        {/* has-steps is what the −/+ frame hangs off on mobile: without the
            buttons there is nothing to frame, and a pill drawn around a bare
            "5 db" reads as a control the row does not have. */}
        <div className={`item-stepper${showControls ? " has-steps" : ""}`}>
          {showControls && (
            <button
              type="button"
              className="icon-btn"
              tabIndex={-1}
              aria-label="Csökkentés"
              disabled={disableDecrement}
              onClick={onDecrement}
            >
              <Icon name="minus" size={11} />
            </button>
          )}
          {isEditing && onAmountChange ? (
            <AmountField
              value={amount}
              onCommit={onAmountChange}
              onDone={stopEditing}
            />
          ) : (
            <span className="item-qty">{qtyLabel}</span>
          )}
          {isEditing && onUnitChange && (
            // data-unit is not decoration: the stylesheet draws a hidden copy of
            // it beside the select and takes the box's width from that, so "l"
            // gets an "l"-sized box instead of a "konzerv"-sized one. See
            // .item-unit-wrap in Home.css.
            <span className="item-unit-wrap" data-unit={unit || ""}>
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
            </span>
          )}
          {showControls && (
            <button
              type="button"
              className="icon-btn"
              tabIndex={-1}
              aria-label="Növelés"
              onClick={onIncrement}
            >
              <Icon name="plus" size={11} />
            </button>
          )}
        </div>

        {canEdit && (
          <button
            type="button"
            className={`icon-btn item-edit${isEditing ? " is-active" : ""}`}
            tabIndex={-1}
            // Not "mennyiségének módosítása" any more: the button now opens the
            // unit and the bin as well, and a label that names only the amount
            // would send a screen reader looking for a delete that is not there.
            aria-label={`${name} szerkesztése`}
            aria-pressed={isEditing}
            onClick={() => (isEditing ? stopEditing() : setEditing(true))}
          >
            <Icon name={isEditing ? "check" : "pen"} size={11} />
          </button>
        )}

        {showControls && (
          <button
            type="button"
            className="icon-btn danger"
            tabIndex={-1}
            aria-label={`${name} törlése`}
            onClick={onDelete}
          >
            <Icon name="trash" size={11} />
          </button>
        )}
      </div>
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
