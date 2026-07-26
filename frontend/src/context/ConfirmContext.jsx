import { createContext, useCallback, useContext, useRef, useState } from "react";
import "./ConfirmModal.css";

const ConfirmContext = createContext(null);

// Promise-based replacement for window.confirm. Usage:
//   const confirm = useConfirm();
//   if (!(await confirm("Biztos?"))) return;
export function ConfirmProvider({ children }) {
  const [message, setMessage] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((msg) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setMessage(msg);
    });
  }, []);

  const settle = (result) => {
    setMessage(null);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(result);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {message !== null && (
        <div className="confirm-overlay" onClick={() => settle(false)}>
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="confirm-message">{message}</p>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-cancel"
                onClick={() => settle(false)}
              >
                Mégse
              </button>
              <button
                type="button"
                className="confirm-ok"
                onClick={() => settle(true)}
              >
                Rendben
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
