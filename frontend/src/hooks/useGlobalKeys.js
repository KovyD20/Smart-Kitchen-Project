import { useEffect, useRef } from "react";
import { isPlainKey, isTypingTarget } from "../lib/keyboard";

// App-wide shortcuts, mounted once from Home.
//
//   Alt+1 .. Alt+9   switch tab (the TABS order)
//   / or Ctrl+K      focus the search field
//   ?                the shortcut cheat sheet
//   Escape           close the topmost layer
//
// Alt+<number> rather than a bare number: the digits stay free for typing an
// amount on a focused row later, and a stray "1" changing tabs mid-work is
// exactly the kind of shortcut people turn off.
//
// Everything except Escape is ignored while the user is typing. Escape is the
// deliberate exception -- abandoning a field is what it is for.
export function useGlobalKeys({
  tabIds,
  onSelectTab,
  onFocusSearch,
  onToggleHelp,
  onEscape,
  enabled = true,
}) {
  // The listener is attached once; the callbacks it reaches for are re-read from
  // this ref on every key press, so Home can pass fresh closures every render
  // without the window listener being torn down and re-added each time.
  const handlers = useRef({});
  useEffect(() => {
    handlers.current = { tabIds, onSelectTab, onFocusSearch, onToggleHelp, onEscape };
  });

  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event) => {
      const {
        tabIds: ids,
        onSelectTab: selectTab,
        onFocusSearch: focusSearch,
        onToggleHelp: toggleHelp,
        onEscape: escape,
      } = handlers.current;

      // A layer that already answered this key (the confirm dialog, a focus
      // trap, the amount field) has priority: one key press, one effect.
      if (event.defaultPrevented) return;

      if (event.key === "Escape") {
        if (!escape?.()) return;
        event.preventDefault();
        return;
      }

      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        // event.code, not event.key: with Alt held, some keyboard layouts report
        // a symbol instead of the digit.
        const match = /^Digit([1-9])$/.exec(event.code || "");
        const index = match ? Number(match[1]) - 1 : -1;
        if (index >= 0 && index < (ids?.length || 0)) {
          event.preventDefault();
          selectTab?.(ids[index]);
        }
        return;
      }

      if (isTypingTarget(event)) return;

      // Ctrl+K is Chrome's address bar and "/" is Firefox's quick find, so both
      // need the default suppressed or the shortcut lands outside the app.
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        focusSearch?.();
        return;
      }

      if (!isPlainKey(event)) return;

      if (event.key === "/") {
        event.preventDefault();
        focusSearch?.();
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        toggleHelp?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
