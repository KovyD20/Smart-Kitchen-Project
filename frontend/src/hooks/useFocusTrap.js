import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

// Focus trap for overlay layers: moves focus in on open, keeps Tab inside, calls
// onEscape, and puts focus back where it came from on close.
//
// The restore is the part that is easy to skip and most missed: without it,
// closing a dialog drops focus on <body> and the keyboard user has to Tab in
// from the top of the page again.
export function useFocusTrap(active, { onEscape } = {}) {
  const containerRef = useRef(null);
  // Kept in a ref so a caller can pass a fresh arrow function every render
  // without the trap being torn down and set up again (which would re-run the
  // "focus the first control" step and fight the user's own Tab).
  const escapeRef = useRef(onEscape);
  useEffect(() => {
    escapeRef.current = onEscape;
  });

  useEffect(() => {
    if (!active) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // No visibility check: the selector already skips disabled controls and
    // anything opted out with tabindex="-1", and an offsetParent test would
    // depend on layout the overlay does not always have measured yet.
    const focusables = () =>
      Array.from(container.querySelectorAll(FOCUSABLE)).filter(
        (el) => !el.hasAttribute("hidden") && !el.closest("[hidden]"),
      );

    // Prefer the first real control; fall back to the container itself, which
    // the caller is expected to render with tabIndex={-1}.
    (focusables()[0] || container).focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (!escapeRef.current) return;
        event.preventDefault();
        // Stops the layer below (Home's global Escape) from closing as well:
        // one Escape closes exactly one layer.
        event.stopPropagation();
        escapeRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const list = focusables();
      if (list.length === 0) {
        event.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && (current === first || !container.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("keydown", onKeyDown);
      // Only if the trap still owns the focus: if something else already moved
      // it on purpose, yanking it back would be the bug.
      if (!opener) return;
      if (document.activeElement === document.body || container.contains(document.activeElement)) {
        opener.focus();
      }
    };
  }, [active]);

  return containerRef;
}
