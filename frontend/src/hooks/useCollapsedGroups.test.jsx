// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useCollapsedGroups } from "./useCollapsedGroups";

const KEYS = ["Zöldségek", "Húsfélék", "Snackek"];

afterEach(cleanup);

describe("useCollapsedGroups", () => {
  it("starts with every group open", () => {
    const { result } = renderHook(() => useCollapsedGroups());
    KEYS.forEach((key) => expect(result.current.isOpen(key)).toBe(true));
    expect(result.current.anyClosed(KEYS)).toBe(false);
  });

  it("treats a key it has never seen as open", () => {
    // Closed keys are the stored side, so a category arriving in a later snapshot
    // defaults to open without anyone registering it.
    const { result } = renderHook(() => useCollapsedGroups());
    expect(result.current.isOpen("Vadonatúj kategória")).toBe(true);
  });

  it("toggles one group without touching the others", () => {
    const { result } = renderHook(() => useCollapsedGroups());

    act(() => result.current.toggle("Húsfélék"));

    expect(result.current.isOpen("Húsfélék")).toBe(false);
    expect(result.current.isOpen("Zöldségek")).toBe(true);
    expect(result.current.anyClosed(KEYS)).toBe(true);
  });

  it("toggles the same group back open", () => {
    const { result } = renderHook(() => useCollapsedGroups());

    act(() => result.current.toggle("Húsfélék"));
    act(() => result.current.toggle("Húsfélék"));

    expect(result.current.isOpen("Húsfélék")).toBe(true);
  });

  it("closes every named group at once", () => {
    const { result } = renderHook(() => useCollapsedGroups());

    act(() => result.current.closeAll(KEYS));

    KEYS.forEach((key) => expect(result.current.isOpen(key)).toBe(false));
    expect(result.current.anyClosed(KEYS)).toBe(true);
  });

  it("opens everything, including groups closed one by one", () => {
    const { result } = renderHook(() => useCollapsedGroups());

    act(() => result.current.toggle("Zöldségek"));
    act(() => result.current.toggle("Snackek"));
    act(() => result.current.openAll());

    KEYS.forEach((key) => expect(result.current.isOpen(key)).toBe(true));
    expect(result.current.anyClosed(KEYS)).toBe(false);
  });

  it("only closes the keys it was given", () => {
    // closeAll replaces the closed set, so a group not in the list stays open.
    const { result } = renderHook(() => useCollapsedGroups());

    act(() => result.current.closeAll(["Zöldségek"]));

    expect(result.current.isOpen("Zöldségek")).toBe(false);
    expect(result.current.isOpen("Húsfélék")).toBe(true);
  });

  it("reports a mixed state as 'something is closed'", () => {
    // This is what drives the button's label: anything closed means the useful
    // next action is expanding, not collapsing.
    const { result } = renderHook(() => useCollapsedGroups());

    act(() => result.current.toggle("Snackek"));

    expect(result.current.anyClosed(KEYS)).toBe(true);
  });

  it("tolerates an empty or missing key list", () => {
    const { result } = renderHook(() => useCollapsedGroups());
    expect(result.current.anyClosed([])).toBe(false);
    expect(result.current.anyClosed(undefined)).toBe(false);
  });
});
