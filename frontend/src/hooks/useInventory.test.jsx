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

  it("drops the origin note when the rounded amount merges into an existing item", async () => {
    purchaseByName.set("liszt", { unit: "kg", amount: 1 });
    const { result } = mountLoaded([
      { id: "s1", name: "liszt", amount: 1, unit: "kg", sourceAmount: 2, sourceUnit: "tk" },
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
        amount: 2,
        name: "liszt",
        sourceAmount: DELETE_FIELD,
        sourceUnit: DELETE_FIELD,
      },
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
