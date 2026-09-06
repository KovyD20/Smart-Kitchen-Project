// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import {
  batches,
  DELETE_FIELD,
  emitError,
  emitSnapshot,
  firestoreMock,
  resetListeners,
} from "./firestoreListenerMock";

vi.mock("../firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => firestoreMock);

// Stable identities: a fresh object per render would invalidate the hook's
// useMemos on every render and obscure what the test is actually asserting.
// Package sizes per raw ingredient name; filled in by the tests that need one.
const purchaseByName = new Map();
const catalog = {
  getCatalogItemByName: (name) =>
    purchaseByName.has(name) ? { purchase: purchaseByName.get(name) } : null,
  getMissingCatalogRecommendations: () => [],
  groupItemsByCatalog: (items) => [{ key: "all", items }],
  resolveCanonicalCatalogName: (value) => value,
  resolveCatalogKey: (value) => value,
};
vi.mock("../context/CatalogContext", () => ({ useCatalog: () => catalog }));

const { useInventory } = await import("./useInventory");

const shopPath = (uid) => `users/${uid}/shoppingList`;
const fridgePath = (uid) => `users/${uid}/fridge`;

beforeEach(resetListeners);
afterEach(cleanup);

describe("useInventory loading flag", () => {
  it("starts out loading, before either snapshot arrives", () => {
    const { result } = renderHook(() => useInventory("u1"));
    expect(result.current.inventoryLoading).toBe(true);
  });

  it("stays loading while only the shopping list has arrived", () => {
    const { result } = renderHook(() => useInventory("u1"));

    act(() => emitSnapshot(shopPath("u1"), [{ id: "s1", name: "tojás" }]));

    // Half the data is not loaded: the fridge listener is still pending.
    expect(result.current.inventoryLoading).toBe(true);
    expect(result.current.shoppingList).toEqual([{ id: "s1", name: "tojás" }]);
  });

  it("stays loading while only the fridge has arrived", () => {
    const { result } = renderHook(() => useInventory("u1"));

    act(() => emitSnapshot(fridgePath("u1"), [{ id: "f1", name: "vaj" }]));

    expect(result.current.inventoryLoading).toBe(true);
  });

  it("stops loading once both listeners have delivered", () => {
    const { result } = renderHook(() => useInventory("u1"));

    act(() => emitSnapshot(shopPath("u1"), []));
    act(() => emitSnapshot(fridgePath("u1"), []));

    expect(result.current.inventoryLoading).toBe(false);
  });

  it("stops loading when both listeners error, rather than hanging", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useInventory("u1"));

    act(() => emitError(shopPath("u1")));
    expect(result.current.inventoryLoading).toBe(true);

    act(() => emitError(fridgePath("u1")));
    expect(result.current.inventoryLoading).toBe(false);

    spy.mockRestore();
  });

  it("re-arms on a uid change instead of keeping the old loaded state", () => {
    const { result, rerender } = renderHook(({ uid }) => useInventory(uid), {
      initialProps: { uid: "u1" },
    });

    act(() => emitSnapshot(shopPath("u1"), []));
    act(() => emitSnapshot(fridgePath("u1"), []));
    expect(result.current.inventoryLoading).toBe(false);

    rerender({ uid: "u2" });
    expect(result.current.inventoryLoading).toBe(true);

    act(() => emitSnapshot(shopPath("u2"), []));
    act(() => emitSnapshot(fridgePath("u2"), []));
    expect(result.current.inventoryLoading).toBe(false);
  });

  it("is not loading without a uid, so the banner cannot stick open", () => {
    const { result } = renderHook(() => useInventory(null));
    expect(result.current.inventoryLoading).toBe(false);
  });
});

describe("useInventory shop-package rounding", () => {
  beforeEach(() => {
    purchaseByName.clear();
    firestoreMock.addDoc.mockResolvedValue({ id: "new" });
  });

  // Both listeners have to deliver before a mutation can see the current list.
  function mountLoaded(shop = [], fridge = []) {
    const hook = renderHook(() => useInventory("u1"));
    act(() => emitSnapshot(shopPath("u1"), shop));
    act(() => emitSnapshot(fridgePath("u1"), fridge));
    return hook;
  }

  it("rounds a recipe ingredient up to a whole package, keeping the original", async () => {
    purchaseByName.set("liszt", { unit: "kg", amount: 1 });
    const { result } = mountLoaded();

    await act(async () => {
      await result.current.addToShoppingList([
        { name: "liszt", amount: 500, unit: "g" },
      ]);
    });

    expect(firestoreMock.addDoc).toHaveBeenCalledWith(
      { path: shopPath("u1") },
      {
        name: "liszt",
        amount: 1,
        unit: "kg",
        sourceAmount: 500,
        sourceUnit: "g",
      },
    );
  });

  it("leaves an ingredient with no package data untouched", async () => {
    const { result } = mountLoaded();

    await act(async () => {
      await result.current.addToShoppingList([
        { name: "kapor", amount: 2, unit: "csokor" },
      ]);
    });

    expect(firestoreMock.addDoc).toHaveBeenCalledWith(
      { path: shopPath("u1") },
      { name: "kapor", amount: 2, unit: "csokor" },
    );
  });

  it("does not round a manually added item — there the amount is the intent", async () => {
    purchaseByName.set("liszt", { unit: "kg", amount: 1 });
    const { result } = mountLoaded();

    await act(async () => {
      await result.current.addSingleShoppingItem({
        name: "liszt",
        amount: 500,
        unit: "g",
      });
    });

    expect(firestoreMock.addDoc).toHaveBeenCalledWith(
      { path: shopPath("u1") },
      { name: "liszt", amount: 500, unit: "g" },
    );
  });

  it("rounds the accumulated total once, not each recipe on its own", async () => {
    // A row this path already wrote: 2 tk of flour, which cannot be measured
    // against a kilo bag, so it bought one. Another recipe now wants 500 g.
    // Rounding each on its own would buy 2 kg; the running total is 500 g, and
    // that is still one bag.
    purchaseByName.set("liszt", { unit: "kg", amount: 1 });
    const { result } = mountLoaded([
      {
        id: "s1",
        name: "liszt",
        amount: 1,
        unit: "kg",
        sourceAmount: 0,
        sourceUnit: "",
        sourceLoose: true,
      },
    ]);

    await act(async () => {
      await result.current.addToShoppingList([
        { name: "liszt", amount: 500, unit: "g" },
      ]);
    });

    expect(firestoreMock.addDoc).not.toHaveBeenCalled();
    expect(firestoreMock.updateDoc).toHaveBeenCalledWith(
      { path: `${shopPath("u1")}/s1` },
      {
        amount: 1,
        name: "liszt",
        unit: "kg",
        sourceAmount: 500,
        sourceUnit: "g",
        sourceLoose: true,
      },
    );
  });

  it("buys one package for a pinch, however many recipes ask for one", async () => {
    // The reported bug: eleven recipes wanting "1 csipet só" bought 11 kg.
    purchaseByName.set("só", { unit: "kg", amount: 1 });
    const { result } = mountLoaded();

    await act(async () => {
      await result.current.addToShoppingList([
        { name: "só", amount: 1, unit: "csipet" },
        { name: "só", amount: 1, unit: "csipet" },
        { name: "só", amount: 1, unit: "csipet" },
      ]);
    });

    expect(firestoreMock.addDoc).toHaveBeenCalledWith(
      { path: shopPath("u1") },
      { name: "só", amount: 1, unit: "kg", sourceAmount: 0, sourceUnit: "", sourceLoose: true },
    );
  });

  it("adds up the raw quantities before rounding them", async () => {
    // 4 x 330 g of sour cream is four tubs — but only because the sum is rounded
    // once. Rounding each 330 g ask on its own would also give four, so the
    // telling case is the fifth line below: 3 x 200 g is 600 g, two tubs, not three.
    purchaseByName.set("tejföl", { unit: "g", amount: 330 });
    const { result } = mountLoaded();

    await act(async () => {
      await result.current.addToShoppingList([
        { name: "tejföl", amount: 200, unit: "g" },
        { name: "tejföl", amount: 200, unit: "g" },
        { name: "tejföl", amount: 200, unit: "g" },
      ]);
    });

    expect(firestoreMock.addDoc).toHaveBeenCalledWith(
      { path: shopPath("u1") },
      { name: "tejföl", amount: 660, unit: "g", sourceAmount: 600, sourceUnit: "g" },
    );
  });

  it("merges the same item across several lines of one call into one row", async () => {
    purchaseByName.set("tojás", { unit: "db", amount: 10 });
    const { result } = mountLoaded();

    await act(async () => {
      await result.current.addToShoppingList([
        { name: "tojás", amount: 6, unit: "db" },
        { name: "tojás", amount: 6, unit: "db" },
      ]);
    });

    // One document, not two: the snapshot cannot refresh between the two writes.
    expect(firestoreMock.addDoc).toHaveBeenCalledTimes(1);
    expect(firestoreMock.addDoc).toHaveBeenCalledWith(
      { path: shopPath("u1") },
      { name: "tojás", amount: 20, unit: "db", sourceAmount: 12, sourceUnit: "db" },
    );
  });

  it("keeps unaddable units apart when the item has no package to round to", async () => {
    // "Bors" is not in the catalog, so there is no package unit to convert
    // through. A teaspoon and ten peppercorns are not eleven and a half of
    // anything: they stay two rows rather than becoming one wrong number.
    const { result } = mountLoaded();

    await act(async () => {
      await result.current.addToShoppingList([
        { name: "bors", amount: 1.5, unit: "tk" },
        { name: "bors", amount: 10, unit: "szem" },
      ]);
    });

    expect(firestoreMock.addDoc).toHaveBeenCalledTimes(2);
    expect(firestoreMock.addDoc).toHaveBeenCalledWith(
      { path: shopPath("u1") },
      { name: "bors", amount: 1.5, unit: "tk" },
    );
    expect(firestoreMock.addDoc).toHaveBeenCalledWith(
      { path: shopPath("u1") },
      { name: "bors", amount: 10, unit: "szem" },
    );
  });

  it("still merges compatible units on an item with no package data", async () => {
    const { result } = mountLoaded();

    await act(async () => {
      await result.current.addToShoppingList([
        { name: "kapor", amount: 500, unit: "g" },
        { name: "kapor", amount: 1, unit: "kg" },
      ]);
    });

    expect(firestoreMock.addDoc).toHaveBeenCalledTimes(1);
    expect(firestoreMock.addDoc).toHaveBeenCalledWith(
      { path: shopPath("u1") },
      { name: "kapor", amount: 1500, unit: "g" },
    );
  });

  it("does not fold an unaddable ask into an existing row of another unit", async () => {
    // The row already on the list is what the previous test would have written.
    const { result } = mountLoaded([
      { id: "s1", name: "bors", amount: 1.5, unit: "tk" },
    ]);

    await act(async () => {
      await result.current.addToShoppingList([
        { name: "bors", amount: 10, unit: "szem" },
      ]);
    });

    expect(firestoreMock.updateDoc).not.toHaveBeenCalled();
    expect(firestoreMock.addDoc).toHaveBeenCalledWith(
      { path: shopPath("u1") },
      { name: "bors", amount: 10, unit: "szem" },
    );
  });

  it("tops up a hand-entered row instead of recomputing it away", async () => {
    // No source fields: the 3 kg is the user's own number, so the recipe's
    // package is added to it rather than replacing it.
    purchaseByName.set("liszt", { unit: "kg", amount: 1 });
    const { result } = mountLoaded([
      { id: "s1", name: "liszt", amount: 3, unit: "kg" },
    ]);

    await act(async () => {
      await result.current.addToShoppingList([
        { name: "liszt", amount: 500, unit: "g" },
      ]);
    });

    expect(firestoreMock.updateDoc).toHaveBeenCalledWith(
      { path: `${shopPath("u1")}/s1` },
      { amount: 4, name: "liszt" },
    );
  });
});

describe("useInventory batched shopping-list deletion", () => {
  function mountLoaded(shop = []) {
    const hook = renderHook(() => useInventory("u1"));
    act(() => emitSnapshot(shopPath("u1"), shop));
    act(() => emitSnapshot(fridgePath("u1"), []));
    return hook;
  }

  const deletedPaths = () =>
    batches.flatMap((batch) =>
      batch.ops.filter((op) => op.type === "delete").map((op) => op.path),
    );

  it("clears the whole list in a single batch, bought items included", async () => {
    const { result } = mountLoaded([
      { id: "s1", name: "liszt", amount: 1, unit: "kg" },
      { id: "s2", name: "tojás", amount: 10, unit: "db", done: true },
      { id: "s3", name: "vaj", amount: 1, unit: "db" },
    ]);

    await act(async () => {
      await result.current.clearShoppingList();
    });

    expect(firestoreMock.writeBatch).toHaveBeenCalledTimes(1);
    expect(deletedPaths()).toEqual([
      `${shopPath("u1")}/s1`,
      `${shopPath("u1")}/s2`,
      `${shopPath("u1")}/s3`,
    ]);
    expect(batches[0].commit).toHaveBeenCalledTimes(1);
    // The per-document path is what the batch replaces; it must stay unused.
    expect(firestoreMock.deleteDoc).not.toHaveBeenCalled();
  });

  it("commits nothing when the list is already empty", async () => {
    const { result } = mountLoaded([]);

    await act(async () => {
      await result.current.clearShoppingList();
    });

    expect(firestoreMock.writeBatch).not.toHaveBeenCalled();
  });

  it("leaves the unbought items alone when only the done ones are cleared", async () => {
    const { result } = mountLoaded([
      { id: "s1", name: "liszt", amount: 1, unit: "kg" },
      { id: "s2", name: "tojás", amount: 10, unit: "db", done: true },
    ]);

    await act(async () => {
      await result.current.clearDoneShoppingItems();
    });

    expect(deletedPaths()).toEqual([`${shopPath("u1")}/s2`]);
  });

  it("splits past Firestore's 500-operation batch limit", async () => {
    const items = Array.from({ length: 501 }, (_, i) => ({
      id: `s${i}`,
      name: `tétel ${i}`,
      amount: 1,
      unit: "db",
    }));
    const { result } = mountLoaded(items);

    await act(async () => {
      await result.current.clearShoppingList();
    });

    expect(firestoreMock.writeBatch).toHaveBeenCalledTimes(2);
    expect(batches[0].ops).toHaveLength(500);
    expect(batches[1].ops).toHaveLength(1);
    expect(deletedPaths()).toHaveLength(501);
  });
});

describe("setShoppingItemAmount / setFridgeItemAmount", () => {
  const withItem = (item) => {
    const { result } = renderHook(() => useInventory("u1"));
    act(() => emitSnapshot(shopPath("u1"), [item]));
    act(() => emitSnapshot(fridgePath("u1"), [item]));
    return result;
  };

  it("writes a typed amount straight to that row", async () => {
    const result = withItem({ id: "s1", name: "liszt", amount: 2, unit: "kg" });

    await act(() => result.current.setShoppingItemAmount(
      { id: "s1", name: "liszt", amount: 2, unit: "kg" },
      { amount: 5 },
    ));

    expect(firestoreMock.updateDoc).toHaveBeenCalledWith(
      { path: `${shopPath("u1")}/s1` },
      { amount: 5, unit: "kg" },
    );
  });

  it("converts the amount when the new unit is compatible", async () => {
    const item = { id: "s1", name: "liszt", amount: 500, unit: "g" };
    const result = withItem(item);

    await act(() => result.current.setShoppingItemAmount(item, { unit: "kg" }));

    // Still the same 500 g of flour, now expressed in kilos.
    expect(firestoreMock.updateDoc).toHaveBeenCalledWith(
      { path: `${shopPath("u1")}/s1` },
      { amount: 0.5, unit: "kg" },
    );
  });

  it("keeps the number when the units cannot be converted", async () => {
    const item = { id: "s1", name: "tojás", amount: 6, unit: "g" };
    const result = withItem(item);

    await act(() => result.current.setShoppingItemAmount(item, { unit: "db" }));

    expect(firestoreMock.updateDoc).toHaveBeenCalledWith(
      { path: `${shopPath("u1")}/s1` },
      { amount: 6, unit: "db" },
    );
  });

  it("drops the shop-rounding note, which no longer explains the amount", async () => {
    const item = {
      id: "s1",
      name: "cukor",
      amount: 1,
      unit: "kg",
      sourceAmount: 2,
      sourceUnit: "tk",
    };
    const result = withItem(item);

    await act(() => result.current.setShoppingItemAmount(item, { amount: 3 }));

    expect(firestoreMock.updateDoc).toHaveBeenCalledWith(
      { path: `${shopPath("u1")}/s1` },
      {
        amount: 3,
        unit: "kg",
        sourceAmount: DELETE_FIELD,
        sourceUnit: DELETE_FIELD,
        sourceLoose: DELETE_FIELD,
      },
    );
  });

  it("writes nothing for a zero or unchanged amount", async () => {
    const item = { id: "s1", name: "liszt", amount: 2, unit: "kg" };
    const result = withItem(item);

    await act(() => result.current.setShoppingItemAmount(item, { amount: 0 }));
    await act(() => result.current.setShoppingItemAmount(item, { amount: 2 }));

    expect(firestoreMock.updateDoc).not.toHaveBeenCalled();
  });

  it("normalizes a written-out unit", async () => {
    const item = { id: "f1", name: "tojás", amount: 6, unit: "g" };
    const result = withItem(item);

    await act(() => result.current.setFridgeItemAmount(item, { unit: "darab" }));

    expect(firestoreMock.updateDoc).toHaveBeenCalledWith(
      { path: `${fridgePath("u1")}/f1` },
      { amount: 6, unit: "db" },
    );
  });

  it("edits the fridge row, not the shopping row of the same name", async () => {
    const item = { id: "f1", name: "vaj", amount: 1, unit: "db" };
    const result = withItem(item);

    await act(() => result.current.setFridgeItemAmount(item, { amount: 4 }));

    expect(firestoreMock.updateDoc).toHaveBeenCalledWith(
      { path: `${fridgePath("u1")}/f1` },
      { amount: 4, unit: "db" },
    );
  });
});
