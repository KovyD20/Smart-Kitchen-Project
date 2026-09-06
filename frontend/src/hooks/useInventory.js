import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  deleteField,
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
  areUnitsCompatible,
  convertAmount,
  normalizeUnit,
  stripAmountsAndUnits,
  unitInfo,
} from "../lib/units";
import { upsertInventoryItem, upsertPurchaseItem } from "../lib/inventory";

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
  //
  // The rounding happens once, on the accumulated raw quantity, never per
  // ingredient — rounding first and adding the results up would buy a kilo of
  // salt for every recipe that wanted a pinch. upsertPurchaseItem keeps that
  // running total on the document so it holds across calls too, one per recipe.
  const addToShoppingList = async (ingredients) => {
    // Grouped up front: the same item can appear on several lines of one recipe,
    // and the awaited writes below would otherwise each see the same pre-write
    // snapshot and open a second row for it.
    //
    // An item with package data groups on the name alone — every ask rounds into
    // the same package. Without one there is nothing to convert through, so the
    // asks group by what they can actually be added to as well: a teaspoon of
    // pepper and ten peppercorns stay two rows rather than becoming one wrong
    // number.
    const groups = new Map();
    for (const ing of ingredients) {
      const rawName = (ing?.name || "").toString().trim();
      if (!rawName) continue;
      const amount = Number(ing?.amount || 0);
      if (!amount || amount <= 0) continue;

      const nameKey = normalizeName(rawName);
      const purchase = getCatalogItemByName(rawName)?.purchase;
      const hasPackage = Boolean(purchase?.unit) && Number(purchase?.amount) > 0;

      const unit = normalizeUnit(ing?.unit);
      const { kind } = unitInfo(unit);
      // Mirrors areUnitsCompatible: mass and volume convert within themselves,
      // everything else only matches its own unit.
      const bucket =
        kind === "mass" || kind === "volume" ? kind : unit;
      const key = hasPackage ? nameKey : `${nameKey}|${bucket}`;

      const group = groups.get(key) || { name: rawName, purchase, asks: [] };
      group.asks.push({ amount, unit });
      groups.set(key, group);
    }

    for (const group of groups.values()) {
      await upsertPurchaseItem({
        db,
        uid,
        list: shoppingList,
        canonicalName: canonicalizeName(group.name),
        asks: group.asks,
        purchase: group.purchase,
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
      // Nudging the amount by hand makes it the user's number, exactly as typing
      // it does, so the recipe total behind it stops applying — see
      // setInventoryItemAmount.
      ...(item.sourceAmount === undefined && item.sourceLoose === undefined
        ? {}
        : {
            sourceAmount: deleteField(),
            sourceUnit: deleteField(),
            sourceLoose: deleteField(),
          }),
    });
  };

  // Direct edit of one row's amount or unit, for both collections.
  //
  // A plain updateDoc, deliberately not the upsert path: the user is correcting
  // *this* line, so it must not be silently merged into a compatible sibling.
  //
  // Switching to a compatible unit converts (500 g -> 0.5 kg) rather than
  // keeping the number, because the row still names the same quantity of food --
  // "500 kg" would be a different, absurd item. Between incompatible units
  // (g -> db) there is no arithmetic, so only the label changes.
  const setInventoryItemAmount =
    (collectionName) =>
    async (item, { amount, unit } = {}) => {
      if (!uid || !item?.id) return;

      let nextAmount = amount === undefined ? Number(item.amount || 0) : Number(amount);
      let nextUnit = item.unit;

      if (unit !== undefined) {
        const normalized = normalizeUnit(unit);
        if (!normalized) return;
        if (normalized !== item.unit) {
          const from = unitInfo(item.unit);
          const to = unitInfo(normalized);
          if (areUnitsCompatible(from, to)) {
            // Two decimals: the conversion factors are powers of ten, so this
            // only trims float noise (0.30000000000000004 -> 0.3).
            nextAmount =
              Math.round(convertAmount(nextAmount, from, to) * 100) / 100;
          }
        }
        nextUnit = normalized;
      }

      if (!Number.isFinite(nextAmount) || nextAmount <= 0) return;
      if (nextAmount === Number(item.amount || 0) && nextUnit === item.unit) return;

      await updateDoc(doc(db, "users", uid, collectionName, item.id), {
        amount: nextAmount,
        unit: nextUnit,
        // The "recept: 2 tk" note explains a shop-rounded amount. Once the user
        // sets the amount by hand it explains nothing, so it goes — and with it
        // the running raw total, so a later recipe add tops this number up
        // instead of recomputing it away.
        ...(item.sourceAmount === undefined && item.sourceLoose === undefined
          ? {}
          : {
              sourceAmount: deleteField(),
              sourceUnit: deleteField(),
              sourceLoose: deleteField(),
            }),
      });
    };

  const setShoppingItemAmount = setInventoryItemAmount("shoppingList");
  const setFridgeItemAmount = setInventoryItemAmount("fridge");

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
    setShoppingItemAmount,
    setFridgeItemAmount,
    toggleShoppingItemDone,
    deleteShoppingItem,
    clearDoneShoppingItems,
    clearShoppingList,
    moveShoppingToFridge,
    addToFridge,
    deleteFridgeItem,
  };
}
