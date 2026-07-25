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
      },
      (err) => console.error("Hiba a receptek olvasásakor", err),
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
    addTag,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    deleteTagGlobally,
  };
}
