// Shared keyboard helpers. Every global or list-level shortcut in the app asks
// `isTypingTarget` first, in one place: the classic failure of a shortcut-heavy
// UI is the "d" of "dió" deleting the row the user is typing into.

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

// Input types that are really buttons -- a checkbox does not swallow letters, so
// a shortcut over one is still a shortcut.
const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

export function isTypingTarget(eventOrTarget) {
  const target =
    eventOrTarget && "target" in eventOrTarget
      ? eventOrTarget.target
      : eventOrTarget;
  if (!target || typeof target !== "object") return false;

  // The attribute as well as the property: jsdom does not implement
  // isContentEditable, and the attribute is what the markup actually says.
  if (target.isContentEditable) return true;
  const editable = target.getAttribute?.("contenteditable");
  if (editable != null && editable !== "false") return true;

  const tag = target.tagName;
  if (!TYPING_TAGS.has(tag)) return false;
  if (tag === "INPUT") {
    const type = String(target.type || "text").toLowerCase();
    if (NON_TEXT_INPUT_TYPES.has(type)) return false;
  }
  return true;
}

// The attribute a roving-tabindex list puts on each of its items
// (useListKeyboardNav). It lives here because both navigation layers have to
// agree on it: the list uses it to walk its own rows, and the page-wide
// navigation to recognise a row as somewhere the focus may go. Only one row of
// a whole list carries tabIndex 0, so judging by the tab order alone would hide
// every other row from the arrow keys -- including every row of the card beside
// the current one.
export const ROVING_ITEM_ATTR = "data-kbd-item";

// Props that put an element within reach of the arrow keys without adding a tab
// stop. For read-only content a keyboard user still has to get to: the steps of
// a recipe and the fridge-match rows are the reason -- focusing a row is what
// scrolls it into view, and those panels have no control inside them to focus
// instead, so without this their lower half was unreachable without a mouse.
export function arrowReachable(key) {
  return { tabIndex: -1, [ROVING_ITEM_ATTR]: key };
}

// True for a plain key press: no modifier that would make it a browser or OS
// shortcut. Shift is allowed, otherwise "?" (Shift+/) could never be a shortcut.
export function isPlainKey(event) {
  return !event.ctrlKey && !event.metaKey && !event.altKey;
}
