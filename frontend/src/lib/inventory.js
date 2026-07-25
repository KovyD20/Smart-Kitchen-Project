import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
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
    });
    return { status: "merged", id: existing.id };
  }

  if (createAmount <= 0) return { status: "skipped" };
  const ref = await addDoc(collection(db, "users", uid, collectionName), {
    name: canonicalName,
    amount: createAmount,
    unit,
  });
  return { status: "created", id: ref.id };
}
