import { useCallback, useEffect } from "react";
import { isPlainKey, isTypingTarget, ROVING_ITEM_ATTR } from "../lib/keyboard";
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
// line, a number input steps its value. Escape is how you leave those. A field
// that only needs one axis hands the other one back:
//
//   "vertical-only"   -- a single-line text field. Left/right are the caret's,
//                        up/down have nothing to do and may move the focus.
//   "horizontal-only" -- a select or a number field. Both spend their meaning on
//                        the vertical axis (an option list is a column, a
//                        stepper counts up and down), so left/right are free to
//                        move on -- and they have to be, because both sit
//                        wedged in a row of other controls. An open shopping
//                        row is amount, unit and note side by side, and with
//                        both fields keeping all four arrows the focus could
//                        enter but never leave: the note was unreachable
//                        without a mouse.
function fieldArrowPolicy(element) {
  if (!isTypingTarget(element)) return "navigate";
  const tag = element.tagName;
  if (tag === "TEXTAREA") return "native";
  if (tag === "SELECT") return "horizontal-only";
  if (tag === "INPUT") {
    const type = String(element.type || "text").toLowerCase();
    if (type === "number") return "horizontal-only";
    // A date or time field really does use left/right itself, to walk between
    // its segments, so it keeps every arrow. (A slider never reaches this
    // branch: isTypingTarget counts range as a button, so the arrows move the
    // focus rather than its value.)
    if (type === "date" || type === "time") return "native";
    // Left/right are the caret's; up/down are free.
    return "vertical-only";
  }
  return "native";
}

// Whether the caret in a text field still has somewhere to go the pressed way.
//
// This is what lets a text field be left sideways at all. Left/right belong to
// the caret while there is text to walk, but at the end of the value the press
// is spare -- and handing it back is the difference between the note on an open
// shopping row being a stop on the way and being a dead end the focus can enter
// but never leave.
function caretCanMove(element, direction) {
  let start = null;
  let end = null;
  try {
    start = element.selectionStart;
    end = element.selectionEnd;
  } catch {
    // Some input types (email, number) refuse to report a selection at all.
    return false;
  }
  if (start === null || end === null) return false;
  // A selection belongs to the caret as well: collapsing it is a real move.
  if (start !== end) return true;
  return direction === "left" ? start > 0 : end < (element.value?.length ?? 0);
}

// checkVisibility rather than a measured rect: it answers "display:none or
// visibility:hidden, on this element or an ancestor" without a layout pass, and
// environments that do not implement it (jsdom) simply say yes.
function isVisible(element) {
  return element.checkVisibility ? element.checkVisibility() : true;
}

function isCandidate(element) {
  if (element.disabled) return false;
  // Out of the tab order and not a roving list item: something we deliberately
  // took out of reach (the buttons inside a list row, which the row's own keys
  // drive instead).
  //
  // A roving item is the opposite case -- focusable, and the only way to it is
  // an arrow key. Excluding it would leave a shopping list whose focus cannot
  // move sideways at all: every row of the neighbouring card sits at
  // tabIndex -1, so there would be nothing for Right to land on.
  if (element.tabIndex < 0 && !element.hasAttribute(ROVING_ITEM_ATTR))
    return false;
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
        if (
          policy === "vertical-only" &&
          direction !== "up" &&
          direction !== "down" &&
          caretCanMove(active, direction)
        )
          return;
        if (
          policy === "horizontal-only" &&
          direction !== "left" &&
          direction !== "right"
        )
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
