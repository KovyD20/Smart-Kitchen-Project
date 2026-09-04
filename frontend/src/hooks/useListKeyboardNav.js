import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { isTypingTarget } from "../lib/keyboard";
import { bestInDirection } from "../lib/spatialFocus";

const ITEM_ATTR = "data-kbd-item";
const ITEM_SELECTOR = `[${ITEM_ATTR}]`;
// Where focus goes when the last item disappears. Falls back to the container
// itself, which callers render with tabIndex={-1}.
const FALLBACK_SELECTOR = "[data-kbd-fallback]";

const DIRECTIONS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

// Roving tabindex over a list of elements, driven by the DOM rather than by an
// index the caller has to keep in sync.
//
// Why the DOM: the shopping list is a grid of cards, each with a header and its
// own rows, and the arrows have to walk across card boundaries. Document order
// is exactly the order the user sees, and it stays correct while cards collapse,
// the search filters rows, or Firestore pushes a change -- an index into a
// nested array does not.
//
// Why roving: an ItemRow has four or five buttons, so plain Tab would mean ~180
// stops on a 40-item list. With this hook the row itself is the single stop and
// the arrows do the rest; the inner buttons stay clickable but leave the tab
// order (the caller gives them tabIndex={-1}).
// `layout` decides what the arrows mean:
//
//   "list" -- one column of cards, each with its own header and rows. Up and
//     Down follow document order, which is exactly the reading order and stays
//     right while cards collapse or the search filters rows.
//
//   "grid" -- the recipe cards, several per row. Document order is useless
//     there (the next card is to the right, not below), so all four arrows are
//     resolved by geometry among the items themselves. This has to live here
//     rather than in the page-wide navigation, because roving tabindex leaves
//     only one card in the tab order: from the outside there is nothing to
//     navigate between.
export function useListKeyboardNav({ layout = "list" } = {}) {
  const containerRef = useRef(null);
  const [activeKey, setActiveKey] = useState(null);
  // Set just before an item is asked to be removed, so focus can land on its
  // neighbour once it is actually gone. Without this the focus falls to <body>
  // after every delete -- the detail that decides whether keyboard navigation
  // feels finished or infuriating.
  const pendingRemovalRef = useRef(null);

  const listItems = useCallback(
    () => Array.from(containerRef.current?.querySelectorAll(ITEM_SELECTOR) || []),
    [],
  );

  // No setActiveKey here on purpose: focusing fires the item's own onFocus,
  // which is the single place the active key is written.
  //
  // `clamp` is what separates the two callers: after a delete the focus must
  // land on *something* inside the list, but an arrow key past the last row has
  // to fail, so the page-wide navigation can carry the focus out of the list
  // instead of pinning it to the edge.
  const focusAt = useCallback((items, index, { clamp = false } = {}) => {
    if (items.length === 0) {
      const container = containerRef.current;
      const target = container?.querySelector(FALLBACK_SELECTOR) || container;
      target?.focus();
      return Boolean(target);
    }
    const bounded = clamp ? Math.max(0, Math.min(index, items.length - 1)) : index;
    const target = items[bounded];
    if (!target) return false;
    target.focus();
    return true;
  }, []);

  // Runs after every render, without a dependency list: its whole job is to
  // check the freshly rendered DOM. It keeps the single tab stop valid (the
  // active item can have just been deleted) and completes a pending removal.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const items = listItems();
    const keys = items.map((el) => el.getAttribute(ITEM_ATTR));

    const pending = pendingRemovalRef.current;
    if (pending && !keys.includes(pending.key)) {
      pendingRemovalRef.current = null;
      focusAt(items, pending.index, { clamp: true });
      return;
    }

    // Nothing owns the tab stop any more: hand it back to the first item.
    if (activeKey !== null && !keys.includes(activeKey)) setActiveKey(null);
  });

  // Put on the container: one listener for the whole list instead of one per row.
  const onKeyDown = useCallback(
    (event) => {
      const direction = DIRECTIONS[event.key];
      if (!direction) return;
      if (layout === "list" && direction !== "up" && direction !== "down") return;
      if (event.defaultPrevented || isTypingTarget(event)) return;
      const current = event.target.closest?.(ITEM_SELECTOR);
      if (!current || !containerRef.current?.contains(current)) return;

      const items = listItems();
      const index = items.indexOf(current);
      if (index === -1) return;

      // Nothing that way is left unhandled on purpose: the arrow then belongs
      // to the page-wide navigation, which carries the focus out of the list.
      if (layout === "grid") {
        const next = bestInDirection(current, direction, items);
        if (!next) return;
        event.preventDefault();
        next.focus();
        return;
      }

      const moved = focusAt(items, index + (direction === "down" ? 1 : -1));
      if (moved) event.preventDefault();
    },
    [layout, listItems, focusAt],
  );

  // Spread on every navigable element. `first` marks the item that owns the tab
  // stop before anything has been focused.
  const itemProps = (key, { first = false } = {}) => ({
    [ITEM_ATTR]: key,
    tabIndex: (activeKey === null ? first : activeKey === key) ? 0 : -1,
    onFocus: () => setActiveKey(key),
  });

  const markRemoval = useCallback(
    (key) => {
      const index = listItems().findIndex(
        (el) => el.getAttribute(ITEM_ATTR) === key,
      );
      pendingRemovalRef.current = index === -1 ? null : { key, index };
    },
    [listItems],
  );

  // Called once the remove attempt has settled: if the item is still there the
  // user cancelled, and a stale pending entry must not steal focus later.
  const clearRemoval = useCallback(() => {
    const pending = pendingRemovalRef.current;
    if (!pending) return;
    const stillThere = listItems().some(
      (el) => el.getAttribute(ITEM_ATTR) === pending.key,
    );
    if (stillThere) pendingRemovalRef.current = null;
  }, [listItems]);

  return { containerRef, onKeyDown, itemProps, markRemoval, clearRemoval };
}
