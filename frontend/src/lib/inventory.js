import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import { unitInfo, areUnitsCompatible, convertAmount } from "./units";

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
