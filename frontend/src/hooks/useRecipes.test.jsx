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

const { useRecipes } = await import("./useRecipes");

const pathFor = (uid) => `users/${uid}/recipes`;

beforeEach(resetListeners);
afterEach(cleanup);

describe("useRecipes loading flag", () => {
  it("starts out loading, before the first snapshot arrives", () => {
    const { result } = renderHook(() => useRecipes("u1"));
    expect(result.current.recipesLoading).toBe(true);
    // The distinction that matters: no recipes yet, but not "no recipes".
    expect(result.current.recipes).toEqual([]);
  });

  it("stops loading once the first snapshot arrives", () => {
    const { result } = renderHook(() => useRecipes("u1"));

    act(() => emitSnapshot(pathFor("u1"), [{ id: "r1", name: "Gulyás" }]));

    expect(result.current.recipesLoading).toBe(false);
    expect(result.current.recipes).toEqual([{ id: "r1", name: "Gulyás" }]);
  });

  it("stops loading on an empty snapshot, so an empty list can render", () => {
    const { result } = renderHook(() => useRecipes("u1"));

    act(() => emitSnapshot(pathFor("u1"), []));

    expect(result.current.recipesLoading).toBe(false);
    expect(result.current.recipes).toEqual([]);
  });

  it("stops loading when the listener errors, rather than hanging", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useRecipes("u1"));

    act(() => emitError(pathFor("u1")));

    expect(result.current.recipesLoading).toBe(false);
    spy.mockRestore();
  });

  it("re-arms on a uid change instead of keeping the old loaded state", () => {
    const { result, rerender } = renderHook(({ uid }) => useRecipes(uid), {
      initialProps: { uid: "u1" },
    });

    act(() => emitSnapshot(pathFor("u1"), [{ id: "r1", name: "Gulyás" }]));
    expect(result.current.recipesLoading).toBe(false);

    rerender({ uid: "u2" });
    expect(result.current.recipesLoading).toBe(true);

    act(() => emitSnapshot(pathFor("u2"), []));
    expect(result.current.recipesLoading).toBe(false);
  });

  it("is not loading without a uid, so the banner cannot stick open", () => {
    const { result } = renderHook(() => useRecipes(null));
    expect(result.current.recipesLoading).toBe(false);
  });

  it("derives allTags from the snapshot", () => {
    const { result } = renderHook(() => useRecipes("u1"));

    act(() =>
      emitSnapshot(pathFor("u1"), [
        { id: "r1", name: "Gulyás", tags: ["magyar", "leves"] },
        { id: "r2", name: "Pörkölt", tags: ["magyar"] },
      ]),
    );

    expect(result.current.allTags).toEqual(["magyar", "leves"]);
  });
});
