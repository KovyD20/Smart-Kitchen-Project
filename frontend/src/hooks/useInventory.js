import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { useCatalog } from "../context/CatalogContext";
import { normalizeUnit, stripAmountsAndUnits } from "../lib/units";
import { upsertInventoryItem } from "../lib/inventory";

// Owns the user's shopping list + fridge: real-time listeners, catalog-grouped
// views, recommendations, and all mutations (including moving the whole list
// into the fridge, which couples the two collections). Pure data ops — UI
// concerns (confirm/toast) stay in the caller.
export function useInventory(uid) {
  const {
    getMissingCatalogRecommendations,
    groupItemsByCatalog,
    resolveCanonicalCatalogName,
    resolveCatalogKey,
  } = useCatalog();

  const [shoppingList, setShoppingList] = useState([]);
  const [fridge, setFridge] = useState([]);

  const normalizeName = (value) =>
    resolveCatalogKey(stripAmountsAndUnits(value));

  const canonicalizeName = (value) => {
    const raw = (value || "").toString().trim();
    if (!raw) return "";
    // Resolve against the catalog by the RAW (accented) name. resolveCanonicalCatalogName
    // normalizes internally for the lookup, and on a no-match it returns the input as-is —
    // so passing `raw` (not the accent-stripped key) keeps accents on non-catalog items.
    return resolveCanonicalCatalogName(raw);
  };

  useEffect(() => {
    if (!uid) return;

    const shopRef = collection(db, "users", uid, "shoppingList");
    const fridgeRef = collection(db, "users", uid, "fridge");

    const unsubShop = onSnapshot(
      query(shopRef, orderBy("name")),
      (snap) => setShoppingList(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error("Hiba a bevásárlólista olvasásakor", err),
    );

    const unsubFridge = onSnapshot(
      query(fridgeRef, orderBy("name")),
      (snap) => setFridge(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error("Hiba a hűtő olvasásakor", err),
    );

    return () => {
      unsubShop();
      unsubFridge();
    };
  }, [uid]);

  const groupedShoppingList = useMemo(
    () => groupItemsByCatalog(shoppingList),
    [shoppingList, groupItemsByCatalog],
  );

  const groupedFridge = useMemo(
    () => groupItemsByCatalog(fridge),
    [fridge, groupItemsByCatalog],
  );

  const missingRecommendations = useMemo(
    () => getMissingCatalogRecommendations(fridge, shoppingList),
    [fridge, shoppingList, getMissingCatalogRecommendations],
  );

  const addToShoppingList = async (ingredients) => {
    for (const ing of ingredients) {
      const rawName = (ing?.name || "").toString().trim();
      if (!rawName) continue;
      const amount = Number(ing?.amount || 0);
      if (!amount || amount <= 0) continue;

      await upsertInventoryItem({
        db,
        uid,
        collectionName: "shoppingList",
        list: shoppingList,
        canonicalName: canonicalizeName(rawName),
        unit: normalizeUnit(ing?.unit),
        mergeAmount: amount,
        nameKeyOf: normalizeName,
      });
    }
  };

  const addSingleShoppingItem = async (item) => {
    const rawName = (item?.name || "").toString().trim();
    const amount = Number(item?.amount || 0);
    if (!rawName || amount <= 0) return;

    await upsertInventoryItem({
      db,
      uid,
      collectionName: "shoppingList",
      list: shoppingList,
      canonicalName: canonicalizeName(rawName),
      unit: normalizeUnit(item?.unit),
      mergeAmount: amount,
      nameKeyOf: normalizeName,
    });
  };

  const updateShoppingItem = async (item, delta) => {
    const nextAmount = Number(item.amount || 0) + delta;
    if (nextAmount <= 0) return;
    const canonicalName = canonicalizeName(item?.name);
    await updateDoc(doc(db, "users", uid, "shoppingList", item.id), {
      amount: nextAmount,
      name: canonicalName || item?.name,
    });
  };

  const deleteShoppingItem = (item) =>
    deleteDoc(doc(db, "users", uid, "shoppingList", item.id));

  const clearShoppingList = () =>
    Promise.all(
      shoppingList.map((item) =>
        deleteDoc(doc(db, "users", uid, "shoppingList", item.id)),
      ),
    );

  const moveShoppingToFridge = async () => {
    if (shoppingList.length === 0) return;

    await Promise.all(
      shoppingList.map(async (item) => {
        const rawName = (item?.name || "").toString().trim();
        const amount = Number(item?.amount || 0);
        if (!rawName || amount <= 0) return;

        await upsertInventoryItem({
          db,
          uid,
          collectionName: "fridge",
          list: fridge,
          canonicalName: canonicalizeName(rawName),
          unit: normalizeUnit(item?.unit),
          mergeAmount: amount,
          nameKeyOf: normalizeName,
        });

        await deleteDoc(doc(db, "users", uid, "shoppingList", item.id));
      }),
    );
  };

  const addToFridge = async (item, delta) => {
    const rawName = (item?.name || "").toString().trim();
    if (!rawName) return;
    const amount = Number(item?.amount || 0);
    const change = Number(delta || 0);

    await upsertInventoryItem({
      db,
      uid,
      collectionName: "fridge",
      list: fridge,
      canonicalName: canonicalizeName(rawName),
      unit: normalizeUnit(item?.unit),
      mergeAmount: change !== 0 ? change : amount,
      createAmount: amount,
      nameKeyOf: normalizeName,
    });
  };

  const deleteFridgeItem = (item) =>
    deleteDoc(doc(db, "users", uid, "fridge", item.id));

  return {
    shoppingList,
    fridge,
    groupedShoppingList,
    groupedFridge,
    missingRecommendations,
    addToShoppingList,
    addSingleShoppingItem,
    updateShoppingItem,
    deleteShoppingItem,
    clearShoppingList,
    moveShoppingToFridge,
    addToFridge,
    deleteFridgeItem,
  };
}
