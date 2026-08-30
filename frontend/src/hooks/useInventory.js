import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { useCatalog } from "../context/CatalogContext";
import {
  normalizeUnit,
  stripAmountsAndUnits,
  toPurchaseAmount,
} from "../lib/units";
import { upsertInventoryItem } from "../lib/inventory";

// Firestore's hard limit on operations in a single writeBatch.
const BATCH_LIMIT = 500;

// Owns the user's shopping list + fridge: real-time listeners, catalog-grouped
// views, recommendations, and all mutations (including moving the whole list
// into the fridge, which couples the two collections). Pure data ops — UI
// concerns (confirm/toast) stay in the caller.
export function useInventory(uid) {
  const {
    getCatalogItemByName,
    getMissingCatalogRecommendations,
    groupItemsByCatalog,
    resolveCanonicalCatalogName,
    resolveCatalogKey,
  } = useCatalog();

  const [shoppingList, setShoppingList] = useState([]);
  const [fridge, setFridge] = useState([]);
  // One per listener: the two collections resolve independently, and the view is
  // only really loaded once both have delivered a first snapshot. Stored as the
  // uid we last heard back about (see useRecipes) so loading is derived and a
  // user switch re-arms it on its own.
  const [shopLoadedUid, setShopLoadedUid] = useState(null);
  const [fridgeLoadedUid, setFridgeLoadedUid] = useState(null);
  const shopLoading = Boolean(uid) && shopLoadedUid !== uid;
  const fridgeLoading = Boolean(uid) && fridgeLoadedUid !== uid;

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
      (snap) => {
        setShoppingList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setShopLoadedUid(uid);
      },
      (err) => {
        console.error("Hiba a bevásárlólista olvasásakor", err);
        setShopLoadedUid(uid);
      },
    );

    const unsubFridge = onSnapshot(
      query(fridgeRef, orderBy("name")),
      (snap) => {
        setFridge(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setFridgeLoadedUid(uid);
      },
      (err) => {
        console.error("Hiba a hűtő olvasásakor", err);
        setFridgeLoadedUid(uid);
      },
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

  // Recipes measure in cooking units ("2 tk cukor"); shops sell packages
  // ("1 kg cukor"). Only this path rounds: manual entry and the fridge keep
  // whatever amount the user typed, because there the amount *is* the intent.
  const addToShoppingList = async (ingredients) => {
    for (const ing of ingredients) {
      const rawName = (ing?.name || "").toString().trim();
      if (!rawName) continue;
      const amount = Number(ing?.amount || 0);
      if (!amount || amount <= 0) continue;

      const unit = normalizeUnit(ing?.unit);
      const purchase = getCatalogItemByName(rawName)?.purchase;
      const buy = toPurchaseAmount(amount, unit, purchase);

      await upsertInventoryItem({
        db,
        uid,
        collectionName: "shoppingList",
        list: shoppingList,
        canonicalName: canonicalizeName(rawName),
        unit: buy.unit,
        mergeAmount: buy.amount,
        nameKeyOf: normalizeName,
        purchaseSource: buy.rounded ? { amount, unit } : null,
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

  // The redesigned list lets you tick items off as you shop; `done` is persisted
  // so the state survives a reload and syncs across devices.
  const toggleShoppingItemDone = (item) =>
    updateDoc(doc(db, "users", uid, "shoppingList", item.id), {
      done: !item.done,
    });

  const deleteShoppingItem = (item) =>
    deleteDoc(doc(db, "users", uid, "shoppingList", item.id));

  // Firestore caps one batch at 500 operations, so a long list is split across
  // several. One commit per chunk instead of one request per document: emptying
  // a 40-item list costs a single round trip rather than 40.
  //
  // Nothing is committed for an empty selection -- an empty batch would be a
  // pointless request, and both callers can legitimately be handed nothing.
  const deleteShoppingItems = async (items) => {
    for (let start = 0; start < items.length; start += BATCH_LIMIT) {
      const batch = writeBatch(db);
      for (const item of items.slice(start, start + BATCH_LIMIT)) {
        batch.delete(doc(db, "users", uid, "shoppingList", item.id));
      }
      await batch.commit();
    }
  };

  const clearDoneShoppingItems = () =>
    deleteShoppingItems(shoppingList.filter((item) => item.done));

  // Empties the whole list, bought and unbought alike. The confirmation (and the
  // item count in it) is the caller's job, as with every other mutation here.
  const clearShoppingList = () => deleteShoppingItems(shoppingList);

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
    inventoryLoading: shopLoading || fridgeLoading,
    groupedShoppingList,
    groupedFridge,
    missingRecommendations,
    addToShoppingList,
    addSingleShoppingItem,
    updateShoppingItem,
    toggleShoppingItemDone,
    deleteShoppingItem,
    clearDoneShoppingItems,
    clearShoppingList,
    moveShoppingToFridge,
    addToFridge,
    deleteFridgeItem,
  };
}
