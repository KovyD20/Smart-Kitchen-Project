import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import {
  accumulatePurchase,
  unitInfo,
  areUnitsCompatible,
  convertAmount,
} from "./units";

// Shared "find compatible existing item -> merge amounts (converting units) or
// create a new doc" logic for the per-user Firestore inventory collections
// (shoppingList, fridge). Extracted from the four near-identical mutations in
// Home.jsx so the merge rule lives in one place.
//
// Params:
//   db, uid          - Firestore instance + current user id
//   collectionName   - "shoppingList" | "fridge"
//   list             - current items of that collection (from onSnapshot state)
//   canonicalName    - resolved display name to store
//   unit             - incoming (already normalized) unit
//   mergeAmount      - amount added to an existing item (may be negative: decrement)
//   createAmount     - amount used when creating a new item (defaults to mergeAmount)
//   nameKeyOf        - fn mapping a name to its comparison key (catalog-aware)
//   purchaseSource   - what the amount was before rounding to a shop package
//                      ({ amount, unit }), or null to clear a previous note.
//                      Leave it out entirely on paths that do not round, so
//                      they never touch the fields.
//
// Returns { status: "merged" | "created" | "skipped", id? }.
export async function upsertInventoryItem({
  db,
  uid,
  collectionName,
  list,
  canonicalName,
  unit,
  mergeAmount,
  createAmount = mergeAmount,
  nameKeyOf,
  purchaseSource,
}) {
  const nameKey = nameKeyOf(canonicalName);
  const incomingUnitInfo = unitInfo(unit);

  const existing = list.find((i) => {
    if (nameKeyOf(i.name) !== nameKey) return false;
    return areUnitsCompatible(unitInfo(i.unit), incomingUnitInfo);
  });

  if (existing) {
    const converted = convertAmount(
      mergeAmount,
      incomingUnitInfo,
      unitInfo(existing.unit),
    );
    const nextAmount = Number(existing.amount || 0) + converted;
    if (nextAmount <= 0) return { status: "skipped" };
    await updateDoc(doc(db, "users", uid, collectionName, existing.id), {
      amount: nextAmount,
      name: canonicalName,
      // After a merge the amount is a sum of several sources, so no single
      // recipe quantity explains it — drop the note instead of keeping a stale one.
      ...(purchaseSource === undefined
        ? {}
        : { sourceAmount: deleteField(), sourceUnit: deleteField() }),
    });
    return { status: "merged", id: existing.id };
  }

  if (createAmount <= 0) return { status: "skipped" };
  const ref = await addDoc(collection(db, "users", uid, collectionName), {
    name: canonicalName,
    amount: createAmount,
    unit,
    ...(purchaseSource
      ? { sourceAmount: purchaseSource.amount, sourceUnit: purchaseSource.unit }
      : {}),
  });
  return { status: "created", id: ref.id };
}

// The recipe path onto the shopping list, where the amount is *derived* rather
// than typed: the raw asks accumulate on the document (sourceAmount/sourceUnit/
// sourceLoose) and the amount is recomputed from that running total on every
// add, so the rounding to whole shop packages happens once no matter how many
// recipes want the item. See accumulatePurchase in ./units.
//
// Params as upsertInventoryItem, plus:
//   asks     - this call's raw recipe quantities, [{ amount, unit }]
//   purchase - the item's smallest package from the catalog, or null
//
// Returns { status: "merged" | "created" | "skipped", id? }.
export async function upsertPurchaseItem({
  db,
  uid,
  list,
  canonicalName,
  asks,
  purchase,
  nameKeyOf,
}) {
  const nameKey = nameKeyOf(canonicalName);
  const hasPackage = Boolean(purchase?.unit) && Number(purchase?.amount) > 0;

  // With package data the row is matched on its name alone: the amount stored on
  // it is in the package unit (1 kg of salt) while the recipes ask in cooking
  // units (a pinch), so a unit-compatibility test would never pair the two and
  // would open a second row for the same item.
  //
  // Without it there is no common unit to fall back on, and matching on the name
  // alone would add quantities that cannot be added — a teaspoon of pepper and
  // ten peppercorns are not eleven and a half of anything. Those keep the
  // ordinary name-and-compatible-unit match, and stay separate rows.
  const incomingUnitInfo = unitInfo(asks?.[0]?.unit);
  const existing = list.find((i) => {
    if (nameKeyOf(i.name) !== nameKey) return false;
    if (hasPackage) return true;
    return areUnitsCompatible(unitInfo(i.unit), incomingUnitInfo);
  });

  // Only a row this path wrote carries a running raw total. Without one the
  // amount is the user's own — typed by hand or nudged with +/- — and recomputing
  // it would throw that away, so such a row keeps the plain additive merge.
  //
  // A tracked row whose item has since lost its package data is treated as
  // untracked too: there is no running total to recompute from any more, so
  // adding is the only way not to drop what it had already accumulated.
  const tracked =
    existing &&
    (existing.sourceAmount !== undefined || existing.sourceLoose === true) &&
    hasPackage;
  const previous = tracked
    ? {
        amount: Number(existing.sourceAmount || 0),
        unit: existing.sourceUnit || "",
        loose: existing.sourceLoose === true,
      }
    : null;

  const buy = accumulatePurchase(asks, purchase, previous);
  if (!Number.isFinite(buy.amount) || buy.amount <= 0) return { status: "skipped" };

  const sourceFields = buy.source
    ? {
        sourceAmount: buy.source.amount,
        sourceUnit: buy.source.unit,
        ...(buy.source.loose
          ? { sourceLoose: true }
          : { sourceLoose: deleteField() }),
      }
    : {
        sourceAmount: deleteField(),
        sourceUnit: deleteField(),
        sourceLoose: deleteField(),
      };

  if (existing) {
    // An untracked row's number belongs to the user, so this call's packages are
    // added to it rather than replacing it; from then on it stays untracked.
    const nextAmount = tracked
      ? buy.amount
      : Number(existing.amount || 0) +
        convertAmount(buy.amount, unitInfo(buy.unit), unitInfo(existing.unit));
    if (nextAmount <= 0) return { status: "skipped" };

    await updateDoc(doc(db, "users", uid, "shoppingList", existing.id), {
      amount: nextAmount,
      name: canonicalName,
      ...(tracked ? { unit: buy.unit, ...sourceFields } : {}),
    });
    return { status: "merged", id: existing.id };
  }

  const ref = await addDoc(collection(db, "users", uid, "shoppingList"), {
    name: canonicalName,
    amount: buy.amount,
    unit: buy.unit,
    ...(buy.source
      ? {
          sourceAmount: buy.source.amount,
          sourceUnit: buy.source.unit,
          ...(buy.source.loose ? { sourceLoose: true } : {}),
        }
      : {}),
  });
  return { status: "created", id: ref.id };
}
