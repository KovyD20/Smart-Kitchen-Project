import { useEffect } from "react";
import Icon from "../Icon/Icon";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { groupIngredients } from "../../lib/recipes";

// "Főzés mód" — one step at a time in large type, for reading from across the
// kitchen. Full-screen on mobile, a centered modal on desktop.
export default function CookMode({
  recipeName,
  steps,
  ingredients,
  step,
  isMobile,
  onStep,
  onClose,
}) {
  const total = steps.length;
  const index = Math.min(step, Math.max(0, total - 1));
  const isLast = index + 1 >= total;

  // Escape and the focus trap: the overlay covers the whole app, so Tab must not
  // wander off into the list behind it.
  const modalRef = useFocusTrap(true, { onEscape: onClose });

  // Arrow keys stay on the window, so a laptop propped on the counter steps
  // through the recipe whatever happens to hold the focus.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") onStep(index + 1);
      else if (e.key === "ArrowLeft") onStep(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, onStep]);

  // Two ingredients per step is a rough but useful hint of what to reach for.
  const chips = ingredients.slice(index * 2, index * 2 + 2);

  return (
    <div className="cook-overlay" role="dialog" aria-modal="true">
      <div className="cook-modal" ref={modalRef} tabIndex={-1}>
        <header className="cook-head">
          <button
            type="button"
            className="icon-btn cook-close"
            aria-label="Főzés mód bezárása"
            onClick={onClose}
          >
            <Icon name="xmark" size={15} />
          </button>
          <div className="cook-name">
            {isMobile ? recipeName : `${recipeName} — főzés mód`}
          </div>
          <div className="cook-counter">
            {index + 1} / {total}
          </div>
        </header>

        <div className="cook-progress">
          <div style={{ width: `${Math.round(((index + 1) / total) * 100)}%` }} />
        </div>

        <div className="cook-body">
          {isMobile && <div className="cook-kicker">Lépés {index + 1}</div>}
          <div className="cook-step">{steps[index]}</div>
          {chips.length > 0 && (
            <div className="cook-chip-groups">
              {groupIngredients(chips).map((block, blockIndex) => (
                <div key={blockIndex} className="cook-chips">
                  {block.group && (
                    <span className="cook-chip-group">{block.group}</span>
                  )}
                  {block.items.map((ingredient, i) => (
                    <span key={i} className="cook-chip">
                      {ingredient.amount} {ingredient.unit} {ingredient.name}
                      {ingredient.note?.trim() && (
                        <span className="cook-chip-note">
                          {ingredient.note.trim()}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* What comes after this step. Cooking is a queue: knowing that the onion
            is chopped next is what lets someone start it while the pan heats.
            Deliberately outside .cook-body, which scrolls when a step runs long
            — a preview that scrolls out of sight is no preview.

            The last step keeps the slot rather than dropping it, so the step
            text and the buttons do not jump at the end of every recipe. */}
        {isLast ? (
          <div className="cook-peek is-last">
            <span className="cook-peek-body">
              <span className="cook-peek-label">Ez az utolsó lépés</span>
              <span className="cook-peek-text">
                Utána a „Kész” gomb zárja a főzés módot.
              </span>
            </span>
          </div>
        ) : (
          <button
            type="button"
            className="cook-peek"
            onClick={() => onStep(index + 1)}
          >
            <span className="cook-peek-body">
              <span className="cook-peek-label">
                Következik · {index + 2}. lépés
              </span>
              {/* Clamped to two lines in CSS: this is a glance ahead, and a long
                  step would otherwise take the room the current one needs. */}
              <span className="cook-peek-text">{steps[index + 1]}</span>
            </span>
            <Icon name="arrowRight" size={13} />
          </button>
        )}

        <div className="cook-nav">
          <button
            type="button"
            className="btn-pill cook-prev"
            disabled={index === 0}
            onClick={() => onStep(index - 1)}
          >
            <Icon name="arrowLeft" size={isMobile ? 18 : 14} />
            {!isMobile && "Vissza"}
          </button>
          <button
            type="button"
            className="btn-pill btn-solid cook-next"
            onClick={() => (isLast ? onClose() : onStep(index + 1))}
          >
            {isLast ? "Kész" : "Következő lépés"}
            <Icon name="arrowRight" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
