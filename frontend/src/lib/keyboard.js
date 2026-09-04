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

// True for a plain key press: no modifier that would make it a browser or OS
// shortcut. Shift is allowed, otherwise "?" (Shift+/) could never be a shortcut.
export function isPlainKey(event) {
  return !event.ctrlKey && !event.metaKey && !event.altKey;
}
