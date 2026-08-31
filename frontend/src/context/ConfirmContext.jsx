import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import "./ConfirmModal.css";

const ConfirmContext = createContext(null);

const DEFAULTS = {
  confirmLabel: "Rendben",
  cancelLabel: "Mégse",
  danger: false,
};

// Promise-based replacement for window.confirm. Usage:
//   const confirm = useConfirm();
//   if (!(await confirm("Biztos?"))) return;
//
// A destructive call can say so, which colours the confirm button and lets it
// name the action instead of answering "Rendben":
//   await confirm("Törlöd?", { danger: true, confirmLabel: "Törlés" })
//
// The dialog is keyboard-complete: Enter confirms, Escape cancels, Tab cycles
// inside it, and focus returns to whatever opened it. That matters beyond
// accessibility here -- deleting an item is meant to be Delete then Enter, with
// no reach for the mouse in between.
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolverRef = useRef(null);
  // Whatever held focus when the dialog opened. Without putting it back, closing
  // drops focus onto <body> and a keyboard user has to tab in from the top again.
  const openerRef = useRef(null);
  const confirmButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);

  const confirm = useCallback(
    (message, options) =>
      new Promise((resolve) => {
        resolverRef.current = resolve;
        openerRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        setRequest({ ...DEFAULTS, ...options, message });
      }),
    [],
  );

  // The confirm button carries the default action, so it takes focus on open:
  // Enter then resolves the dialog through the button's own click, and the focus
  // ring shows which action Enter is about to take -- including when it deletes.
  useEffect(() => {
    if (request) confirmButtonRef.current?.focus();
  }, [request]);

  const settle = (result) => {
    setRequest(null);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    const opener = openerRef.current;
    openerRef.current = null;
    resolve?.(result);
    opener?.focus();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      settle(false);
      return;
    }

    if (event.key === "Enter") {
      // Resolved here rather than left to the browser turning Enter on a focused
      // button into a click: preventDefault suppresses that implicit activation,
      // so the dialog settles exactly once however Enter arrives. "Mégse" still
      // cancels when it is the button under the focus ring -- whatever the ring
      // is on is what Enter does.
      event.preventDefault();
      settle(event.target !== cancelButtonRef.current);
      return;
    }

    if (event.key !== "Tab") return;

    // Only two focusable elements, so the trap is just "wrap at both ends".
    const first = cancelButtonRef.current;
    const last = confirmButtonRef.current;
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request !== null && (
        <div className="confirm-overlay" onClick={() => settle(false)}>
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-message"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            <p className="confirm-message" id="confirm-message">
              {request.message}
            </p>
            <div className="confirm-actions">
              <button
                ref={cancelButtonRef}
                type="button"
                className="btn-pill btn-outline"
                onClick={() => settle(false)}
              >
                {request.cancelLabel}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                className={`btn-pill btn-solid confirm-accept${
                  request.danger ? " is-danger" : ""
                }`}
                onClick={() => settle(true)}
              >
                {request.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return ctx;
}
