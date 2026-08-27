import { useCallback, useState } from "react";

// Tracks which collapsible category cards the user closed, keyed by category name.
// Groups start expanded, matching the design.
//
// Closed keys are stored rather than open ones so a card that appears later (a new
// category arriving from a snapshot) defaults to open without anyone registering
// it first.
export function useCollapsedGroups() {
  const [closed, setClosed] = useState(() => new Set());

  const toggle = useCallback(
    (key) =>
      setClosed((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      }),
    [],
  );

  const openAll = useCallback(() => setClosed(new Set()), []);

  // Needs the key list: with "closed" as the stored side, collapsing everything
  // means naming every card that currently exists.
  const closeAll = useCallback((keys) => setClosed(new Set(keys)), []);

  const isOpen = useCallback((key) => !closed.has(key), [closed]);

  const anyClosed = useCallback(
    (keys) => (keys || []).some((key) => closed.has(key)),
    [closed],
  );

  return { isOpen, toggle, openAll, closeAll, anyClosed };
}
