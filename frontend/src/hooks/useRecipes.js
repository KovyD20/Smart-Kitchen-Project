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
  deleteField,
} from "firebase/firestore";
import { db } from "../firebase";
import { deleteRecipeImage, uploadRecipeImage } from "../lib/imageUpload";

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

  const imageUrlOf = (id) => recipes.find((r) => r.id === id)?.imageUrl || null;

  // Marks an error as "the document went through, only the image did not", so
  // the caller can say so instead of reporting a failed save that succeeded.
  const asImageStageError = (err) => {
    if (err && typeof err === "object") err.stage = "image";
    return err;
  };

  // A new recipe has no id until it exists, and the Storage path needs one. So
  // the document is written first and patched with the URL afterwards: an upload
  // that fails leaves a recipe without an image, which the user can retry --
  // whereas uploading first would leave an orphaned file behind on any failure.
  const createRecipe = async (data, { imageFile } = {}) => {
    const created = await addDoc(collection(db, "users", uid, "recipes"), data);
    if (!imageFile) return created;

    try {
      const imageUrl = await uploadRecipeImage({
        uid,
        recipeId: created.id,
        file: imageFile,
      });
      await updateDoc(doc(db, "users", uid, "recipes", created.id), { imageUrl });
    } catch (err) {
      throw asImageStageError(err);
    }
    return created;
  };

  // Replacement order matters: the new file is uploaded and the document points
  // at it before the old object is removed. The other way round, a failed upload
  // would leave the recipe pointing at a file that no longer exists.
  const updateRecipe = async (id, data, { imageFile, removeImage } = {}) => {
    const previousUrl = imageUrlOf(id);
    let patch = data;

    if (imageFile) {
      try {
        patch = {
          ...data,
          imageUrl: await uploadRecipeImage({ uid, recipeId: id, file: imageFile }),
        };
      } catch (err) {
        throw asImageStageError(err);
      }
    } else if (removeImage) {
      // Removing the key rather than storing null keeps "no image" as one state.
      patch = { ...data, imageUrl: deleteField() };
    }

    await updateDoc(doc(db, "users", uid, "recipes", id), patch);

    if (imageFile || removeImage) await deleteRecipeImage(previousUrl);
  };

  // The Storage object outlives the document unless it is removed too, and
  // nothing else would ever reach it again.
  const deleteRecipe = async (id) => {
    const url = imageUrlOf(id);
    await deleteDoc(doc(db, "users", uid, "recipes", id));
    await deleteRecipeImage(url);
  };

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
