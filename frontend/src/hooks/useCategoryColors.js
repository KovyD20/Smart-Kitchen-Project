import { useCallback, useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, deleteField } from "firebase/firestore";
import { db } from "../firebase";
import { categoryAccent } from "../constants/categoryColors";

// Per-user category accent overrides, kept in one document rather than a
// collection: it is a handful of string values, so one read and one write beats
// a listener per category.
const SETTINGS_DOC = ["settings", "preferences"];

// Owns the user's category colour overrides. Anything the user has not changed
// falls back to the fixed palette in constants/categoryColors.js, and an unknown
// category falls back again to the neutral accent -- so colorFor() always returns
// something readable.
export function useCategoryColors(uid) {
  // Last state the server told us about.
  const [remote, setRemote] = useState(null);
  // Values written locally but not yet echoed back by the listener. A Firestore
  // round trip is visible as a lag on a colour swatch, so the choice is applied
  // immediately and this overlay is dropped once the snapshot confirms it.
  // A null value means "reset to the palette default".
  const [pending, setPending] = useState({});

  useEffect(() => {
    if (!uid) return;

    const ref = doc(db, "users", uid, ...SETTINGS_DOC);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const next = snap.data()?.categoryColors || {};
        setRemote(next);
        setPending((prev) => {
          const unconfirmed = {};
          for (const [category, value] of Object.entries(prev)) {
            const settled =
              value === null
                ? next[category] === undefined
                : next[category] === value;
            if (!settled) unconfirmed[category] = value;
          }
          return unconfirmed;
        });
      },
      (err) => {
        // Without overrides the fixed palette still works, so a failed listener
        // degrades to defaults instead of breaking the views.
        console.error("Hiba a kategória-színek olvasásakor", err);
        setRemote({});
      },
    );

    return () => unsub();
  }, [uid]);

  const colorFor = useCallback(
    (category) => {
      const overridden = Object.prototype.hasOwnProperty.call(pending, category)
        ? pending[category]
        : remote?.[category];
      return overridden || categoryAccent(category);
    },
    [pending, remote],
  );

  // True when this category currently differs from the fixed palette, so the UI
  // can offer "reset" only where it does something.
  const isCustom = useCallback(
    (category) => {
      const overridden = Object.prototype.hasOwnProperty.call(pending, category)
        ? pending[category]
        : remote?.[category];
      return Boolean(overridden);
    },
    [pending, remote],
  );

  const write = useCallback(
    (category, value) => {
      if (!uid || !category) return Promise.resolve();
      setPending((prev) => ({ ...prev, [category]: value }));
      return setDoc(
        doc(db, "users", uid, ...SETTINGS_DOC),
        { categoryColors: { [category]: value === null ? deleteField() : value } },
        { merge: true },
      );
    },
    [uid],
  );

  const setColor = useCallback(
    (category, color) => write(category, color),
    [write],
  );

  const resetColor = useCallback((category) => write(category, null), [write]);

  const resetAll = useCallback(() => {
    if (!uid) return Promise.resolve();
    const categories = Object.keys({ ...remote, ...pending });
    setPending(
      categories.reduce((acc, category) => ({ ...acc, [category]: null }), {}),
    );
    return setDoc(
      doc(db, "users", uid, ...SETTINGS_DOC),
      { categoryColors: deleteField() },
      { merge: true },
    );
  }, [uid, remote, pending]);

  return { colorFor, isCustom, setColor, resetColor, resetAll };
}
