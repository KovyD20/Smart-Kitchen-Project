import { useCallback, useEffect } from "react";
import { isPlainKey, isTypingTarget } from "../lib/keyboard";
import { bestInDirection } from "../lib/spatialFocus";

// Everything the browser can focus, minus the things we deliberately took out of
// the tab order (roving list rows keep their inner buttons at tabIndex -1, and
// those are reachable through the row's own keys instead).
const FOCUSABLE = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "[tabindex]",
  '[contenteditable="true"]',
].join(",");

const DIRECTIONS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

// Fields whose arrow keys belong to the widget: a textarea moves its caret by
// line, a number input steps its value, a select changes the option. Escape is
// how you leave those. A single-line text field has nothing to do with the
// vertical arrows, so those may carry the focus onwards.
function fieldArrowPolicy(element) {
  if (!isTypingTarget(element)) return "navigate";
  const tag = element.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return "native";
  if (tag === "INPUT") {
    const type = String(element.type || "text").toLowerCase();
    if (type === "number" || type === "range" || type === "date" || type === "time")
      return "native";
    // Left/right are the caret's; up/down are free.
    return "vertical-only";
  }
  return "native";
}

// checkVisibility rather than a measured rect: it answers "display:none or
// visibility:hidden, on this element or an ancestor" without a layout pass, and
// environments that do not implement it (jsdom) simply say yes.
function isVisible(element) {
  return element.checkVisibility ? element.checkVisibility() : true;
}

function isCandidate(element) {
  if (element.disabled) return false;
  if (element.tabIndex < 0) return false;
  if (element.hasAttribute("data-nav-skip")) return false;
  if (element.closest('[aria-hidden="true"]')) return false;
  if (element.closest("[hidden]")) return false;
  return isVisible(element);
}

// A modal owns the arrows while it is open: moving focus out to the page behind
// it would be worse than not moving at all.
function scopeElement() {
  const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
  return dialogs.length > 0 ? dialogs[dialogs.length - 1] : document.body;
}

// Page-wide arrow navigation, mounted once. It is the *fallback* layer: any
// component that already answered the key (a list row stepping its amount, the
// cook mode changing step) has called preventDefault, and this never sees it.
//
// The point is a page that can be driven with four arrows, Enter and Escape
// alone -- no Tab, no pointer. Enter needs no help: focus lands on real buttons
// and inputs, which activate themselves.
export function useSpatialNav({ enabled = true, onFallback } = {}) {
  const candidates = useCallback(() => {
    const scope = scopeElement();
    return Array.from(scope.querySelectorAll(FOCUSABLE)).filter(isCandidate);
  }, []);

  const moveFocus = useCallback(
    (direction, fromElement) => {
      const list = candidates();
      if (list.length === 0) return false;

      const current =
        fromElement && list.includes(fromElement)
          ? fromElement
          : list.find((el) => el.contains(fromElement)) || null;

      if (!current) {
        // Focus is parked on a container -- a list that just emptied leaves it
        // on the scroll region. Step into that region rather than measuring
        // directions from a box the size of the whole view.
        const inside = fromElement && list.find((el) => fromElement.contains(el));
        // Nothing focused at all: start from the home base (the active tab)
        // rather than from whatever happens to be first in the document, which
        // is the search field and nowhere near where the eye is.
        const home = list.find((el) => el.hasAttribute("data-nav-home"));
        (inside || home || list[0]).focus();
        return true;
      }

      const next = bestInDirection(current, direction, list);
      if (!next) return false;
      next.focus();
      return true;
    },
    [candidates],
  );

  // Escape inside a field means "let me out of here", not "throw away the
  // screen I am on" -- so it moves focus on instead of closing a layer.
  const exitField = useCallback(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !isTypingTarget(active)) return false;
    if (!moveFocus("down", active)) {
      active.blur();
      onFallback?.();
    }
    return true;
  }, [moveFocus, onFallback]);

  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event) => {
      const direction = DIRECTIONS[event.key];
      if (!direction) return;
      // A component that handled the key already decided what it means here.
      if (event.defaultPrevented || !isPlainKey(event)) return;

      const active =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      if (active) {
        const policy = fieldArrowPolicy(active);
        if (policy === "native") return;
        if (policy === "vertical-only" && direction !== "up" && direction !== "down")
          return;
      }

      // Not prevented when nothing lies that way: the arrow then does what it
      // always did and scrolls.
      if (moveFocus(direction, active)) event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, moveFocus]);

  return { moveFocus, exitField };
}
