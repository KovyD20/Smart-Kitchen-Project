import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

// Owns the user's recipes: real-time listener, derived tag set, and CRUD.
// UI concerns (confirm/toast) stay in the caller.
export function useRecipes(uid) {
  const [recipes, setRecipes] = useState([]);
  const [allTags, setAllTags] = useState([]);
  // Until the first snapshot lands, an empty recipe list is indistinguishable
  // from a list that simply has not arrived yet -- the UI needs to tell them
  // apart to avoid rendering an "empty" state over data that is still loading.
  //
  // Tracked as "which uid have we heard back about" rather than a boolean, so
  // loading is derived: it needs no reset when the uid changes (a user switch
  // would otherwise keep the previous user's "loaded" state while their
  // replacement is still in flight), and no setState in the effect body.
  const [loadedUid, setLoadedUid] = useState(null);
  const loading = Boolean(uid) && loadedUid !== uid;

  useEffect(() => {
    if (!uid) return;

    const recipesRef = collection(db, "users", uid, "recipes");
    const unsub = onSnapshot(
      query(recipesRef, orderBy("name")),
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRecipes(items);
        const tags = new Set();
        items.forEach((item) => item.tags?.forEach((tag) => tags.add(tag)));
        setAllTags([...tags]);
        setLoadedUid(uid);
      },
      (err) => {
        console.error("Hiba a receptek olvasásakor", err);
        // A failed listener still ends the wait -- otherwise the banner hangs.
        setLoadedUid(uid);
      },
    );

    return () => unsub();
  }, [uid]);

  // Optimistically surface a tag before any recipe uses it.
  const addTag = (tag) =>
    setAllTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));

  const createRecipe = (data) =>
    addDoc(collection(db, "users", uid, "recipes"), data);

  const updateRecipe = (id, data) =>
    updateDoc(doc(db, "users", uid, "recipes", id), data);

  const deleteRecipe = (id) =>
    deleteDoc(doc(db, "users", uid, "recipes", id));

  // Absent means "not a favourite", so no migration is needed for older recipes.
  const toggleFavorite = (recipe) =>
    updateDoc(doc(db, "users", uid, "recipes", recipe.id), {
      favorite: !recipe.favorite,
    });

  const deleteTagGlobally = async (tag) => {
    const affected = recipes.filter((r) => r.tags?.includes(tag));
    if (affected.length === 0) return;

    const batch = writeBatch(db);
    affected.forEach((r) => {
      const nextTags = (r.tags || []).filter((t) => t !== tag);
      batch.update(doc(db, "users", uid, "recipes", r.id), { tags: nextTags });
    });
    await batch.commit();
  };

  return {
    recipes,
    allTags,
    recipesLoading: loading,
    addTag,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    toggleFavorite,
    deleteTagGlobally,
  };
}
