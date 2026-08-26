// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import {
  DELETE_FIELD,
  emitDocSnapshot,
  emitError,
  firestoreMock,
  resetListeners,
} from "./firestoreListenerMock";

vi.mock("../firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => firestoreMock);

const { useCategoryColors } = await import("./useCategoryColors");

const PREFS = "users/u1/settings/preferences";

beforeEach(resetListeners);
afterEach(cleanup);

describe("useCategoryColors fallback chain", () => {
  it("uses the fixed palette before any snapshot arrives", () => {
    const { result } = renderHook(() => useCategoryColors("u1"));
    expect(result.current.colorFor("Zöldségek")).toBe("var(--cat-vegetables)");
  });

  it("falls back to the neutral accent for an unknown category", () => {
    const { result } = renderHook(() => useCategoryColors("u1"));
    act(() => emitDocSnapshot(PREFS, {}));
    expect(result.current.colorFor("Nincs ilyen")).toBe("var(--cat-other)");
  });

  it("prefers the user's stored colour over the palette", () => {
    const { result } = renderHook(() => useCategoryColors("u1"));

    act(() =>
      emitDocSnapshot(PREFS, { categoryColors: { "Zöldségek": "#ff8fb1" } }),
    );

    expect(result.current.colorFor("Zöldségek")).toBe("#ff8fb1");
    // Categories the user never touched keep the palette default.
    expect(result.current.colorFor("Gyümölcsök")).toBe("var(--cat-fruits)");
  });

  it("keeps the palette when the document has no categoryColors at all", () => {
    const { result } = renderHook(() => useCategoryColors("u1"));
    act(() => emitDocSnapshot(PREFS, { somethingElse: true }));
    expect(result.current.colorFor("Húsfélék")).toBe("var(--cat-meat)");
  });

  it("degrades to the palette when the listener errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useCategoryColors("u1"));

    act(() => emitError(PREFS));

    expect(result.current.colorFor("Pékáruk")).toBe("var(--cat-bakery)");
    spy.mockRestore();
  });

  it("opens no listener without a uid, and still returns palette colours", () => {
    const { result } = renderHook(() => useCategoryColors(null));
    expect(result.current.colorFor("Szárazáru")).toBe("var(--cat-dry)");
  });
});

describe("useCategoryColors isCustom", () => {
  it("is false for a palette default and true for a stored override", () => {
    const { result } = renderHook(() => useCategoryColors("u1"));
    act(() =>
      emitDocSnapshot(PREFS, { categoryColors: { "Snackek": "#67d5e0" } }),
    );

    expect(result.current.isCustom("Snackek")).toBe(true);
    expect(result.current.isCustom("Zöldségek")).toBe(false);
  });
});

describe("useCategoryColors writes", () => {
  it("applies a new colour immediately, before the server echoes it", async () => {
    const { result } = renderHook(() => useCategoryColors("u1"));
    act(() => emitDocSnapshot(PREFS, {}));

    await act(() => result.current.setColor("Zöldségek", "#9b8cff"));

    // The optimistic overlay is the point: a Firestore round trip is a visible
    // lag on a colour swatch.
    expect(result.current.colorFor("Zöldségek")).toBe("#9b8cff");
    expect(firestoreMock.setDoc).toHaveBeenCalledWith(
      { path: PREFS },
      { categoryColors: { "Zöldségek": "#9b8cff" } },
      { merge: true },
    );
  });

  it("drops the optimistic value once the snapshot confirms it", async () => {
    const { result } = renderHook(() => useCategoryColors("u1"));
    act(() => emitDocSnapshot(PREFS, {}));
    await act(() => result.current.setColor("Snackek", "#ffb020"));

    act(() =>
      emitDocSnapshot(PREFS, { categoryColors: { "Snackek": "#ffb020" } }),
    );
    expect(result.current.colorFor("Snackek")).toBe("#ffb020");

    // A later change from another device must win, which only works if the
    // local overlay was cleared.
    act(() =>
      emitDocSnapshot(PREFS, { categoryColors: { "Snackek": "#e5383b" } }),
    );
    expect(result.current.colorFor("Snackek")).toBe("#e5383b");
  });

  it("resets one category back to the palette with deleteField", async () => {
    const { result } = renderHook(() => useCategoryColors("u1"));
    act(() =>
      emitDocSnapshot(PREFS, { categoryColors: { "Snackek": "#ffb020" } }),
    );

    await act(() => result.current.resetColor("Snackek"));

    expect(result.current.colorFor("Snackek")).toBe("var(--cat-snacks)");
    expect(firestoreMock.setDoc).toHaveBeenCalledWith(
      { path: PREFS },
      { categoryColors: { "Snackek": DELETE_FIELD } },
      { merge: true },
    );
  });

  it("resets every category at once", async () => {
    const { result } = renderHook(() => useCategoryColors("u1"));
    act(() =>
      emitDocSnapshot(PREFS, {
        categoryColors: { "Snackek": "#ffb020", "Zöldségek": "#e5383b" },
      }),
    );

    await act(() => result.current.resetAll());

    expect(result.current.colorFor("Snackek")).toBe("var(--cat-snacks)");
    expect(result.current.colorFor("Zöldségek")).toBe("var(--cat-vegetables)");
    expect(firestoreMock.setDoc).toHaveBeenCalledWith(
      { path: PREFS },
      { categoryColors: DELETE_FIELD },
      { merge: true },
    );
  });

  it("writes nothing without a uid or without a category", async () => {
    const { result } = renderHook(() => useCategoryColors(null));
    await act(() => result.current.setColor("Snackek", "#ffb020"));
    expect(firestoreMock.setDoc).not.toHaveBeenCalled();
  });
});
