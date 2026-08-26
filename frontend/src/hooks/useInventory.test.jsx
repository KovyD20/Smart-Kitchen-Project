// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import {
  emitError,
  emitSnapshot,
  firestoreMock,
  resetListeners,
} from "./firestoreListenerMock";

vi.mock("../firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => firestoreMock);

// Stable identities: a fresh object per render would invalidate the hook's
// useMemos on every render and obscure what the test is actually asserting.
const catalog = {
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
