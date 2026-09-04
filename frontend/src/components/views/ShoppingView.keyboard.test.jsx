// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import ShoppingView from "./ShoppingView";

// Phase 6.3: the shopping list has to be usable without a mouse -- arrows to
// move, +/- on the amount, Space to tick off, Delete to remove, and the focus
// landing somewhere sensible afterwards.
const item = (id, name) => ({ id, name, amount: 2, unit: "db", done: false });

const groupsWith = (...items) => [{ category: "Zöldség", items }];

const baseProps = {
  openCount: 3,
  doneCount: 0,
  units: ["db", "g"],
  recommendations: { essential: [], goodToHave: [], extra: [] },
  isMobile: false,
  colorFor: () => "#fff",
  onToggleDone: () => {},
  onUpdateItem: () => {},
  onDeleteItem: () => Promise.resolve(),
  onAddItem: () => {},
  onClearDone: () => {},
  onClearAll: () => {},
  onMoveToFridge: () => {},
};

const rows = () => screen.getAllByRole("listitem");
const header = () => screen.getByRole("button", { name: /Zöldség/ });

afterEach(cleanup);

describe("ShoppingView keyboard navigation", () => {
  const threeItems = () =>
    groupsWith(item("a", "Alma"), item("b", "Bab"), item("c", "Cékla"));

  it("walks down the rows with the arrow keys", () => {
    render(<ShoppingView {...baseProps} groups={threeItems()} />);
    const [first, second, third] = rows();

    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: "ArrowDown" });
    expect(document.activeElement).toBe(third);
    fireEvent.keyDown(third, { key: "ArrowUp" });
    expect(document.activeElement).toBe(second);
  });

  it("reaches the card header above the first row", () => {
    render(<ShoppingView {...baseProps} groups={threeItems()} />);
    rows()[0].focus();
    fireEvent.keyDown(rows()[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(header());
  });

  it("keeps a single tab stop for the whole list", () => {
    render(<ShoppingView {...baseProps} groups={threeItems()} />);
    const stops = [header(), ...rows()].filter((el) => el.tabIndex === 0);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(header());
  });

  it("moves the tab stop to whatever was focused last", () => {
    render(<ShoppingView {...baseProps} groups={threeItems()} />);
    fireEvent.focus(rows()[2]);
    expect(rows()[2].tabIndex).toBe(0);
    expect(rows()[0].tabIndex).toBe(-1);
    expect(header().tabIndex).toBe(-1);
  });

  it("steps the amount with the left and right arrows", () => {
    const onUpdateItem = vi.fn();
    render(
      <ShoppingView {...baseProps} groups={threeItems()} onUpdateItem={onUpdateItem} />,
    );
    fireEvent.keyDown(rows()[0], { key: "ArrowRight" });
    fireEvent.keyDown(rows()[0], { key: "ArrowLeft" });
    expect(onUpdateItem.mock.calls.map((call) => call[1])).toEqual([1, -1]);
  });

  it("ticks an item off with Space", () => {
    const onToggleDone = vi.fn();
    render(
      <ShoppingView {...baseProps} groups={threeItems()} onToggleDone={onToggleDone} />,
    );
    fireEvent.keyDown(rows()[1], { key: " " });
    expect(onToggleDone).toHaveBeenCalledWith(
      expect.objectContaining({ id: "b" }),
    );
  });

  it("asks to delete on Delete and on Backspace", () => {
    const onDeleteItem = vi.fn(() => Promise.resolve());
    render(
      <ShoppingView {...baseProps} groups={threeItems()} onDeleteItem={onDeleteItem} />,
    );
    fireEvent.keyDown(rows()[0], { key: "Delete" });
    fireEvent.keyDown(rows()[1], { key: "Backspace" });
    expect(onDeleteItem.mock.calls.map(([i]) => i.id)).toEqual(["a", "b"]);
  });

  // The detail that decides whether the whole feature feels finished: without
  // it the focus falls to <body> and the next Tab starts from the page top.
  it("moves the focus to the next row after a delete", async () => {
    const onDeleteItem = vi.fn(() => Promise.resolve());
    const { rerender } = render(
      <ShoppingView {...baseProps} groups={threeItems()} onDeleteItem={onDeleteItem} />,
    );
    rows()[1].focus();
    fireEvent.keyDown(rows()[1], { key: "Delete" });

    rerender(
      <ShoppingView
        {...baseProps}
        groups={groupsWith(item("a", "Alma"), item("c", "Cékla"))}
        onDeleteItem={onDeleteItem}
      />,
    );

    await waitFor(() =>
      expect(document.activeElement).toHaveProperty("ariaLabel", "Cékla"),
    );
  });

  it("falls back to the previous row when the last one is deleted", async () => {
    const onDeleteItem = vi.fn(() => Promise.resolve());
    const { rerender } = render(
      <ShoppingView {...baseProps} groups={threeItems()} onDeleteItem={onDeleteItem} />,
    );
    rows()[2].focus();
    fireEvent.keyDown(rows()[2], { key: "Delete" });

    rerender(
      <ShoppingView
        {...baseProps}
        groups={groupsWith(item("a", "Alma"), item("b", "Bab"))}
        onDeleteItem={onDeleteItem}
      />,
    );

    await waitFor(() =>
      expect(document.activeElement).toHaveProperty("ariaLabel", "Bab"),
    );
  });

  it("opens and closes the card with the right and left arrows", () => {
    render(<ShoppingView {...baseProps} groups={threeItems()} />);
    expect(header().getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(header(), { key: "ArrowLeft" });
    expect(header().getAttribute("aria-expanded")).toBe("false");
    // Pointing the same way twice must not reopen it.
    fireEvent.keyDown(header(), { key: "ArrowLeft" });
    expect(header().getAttribute("aria-expanded")).toBe("false");

    fireEvent.keyDown(header(), { key: "ArrowRight" });
    expect(header().getAttribute("aria-expanded")).toBe("true");
  });
});
