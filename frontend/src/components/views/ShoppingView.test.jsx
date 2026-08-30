// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import ShoppingView from "./ShoppingView";

// "Lista ürítése" clears the whole list, so what enables it must be the list
// itself -- not `groups`, which the header search has already filtered down.
const baseProps = {
  groups: [],
  openCount: 0,
  doneCount: 0,
  units: ["db", "g"],
  recommendations: { essential: [], goodToHave: [], extra: [] },
  isMobile: false,
  colorFor: () => "#fff",
  onToggleDone: () => {},
  onUpdateItem: () => {},
  onDeleteItem: () => {},
  onAddItem: () => {},
  onClearDone: () => {},
  onClearAll: () => {},
  onMoveToFridge: () => {},
};

const clearAllButton = () =>
  screen.getByRole("button", { name: "Lista ürítése" });

afterEach(cleanup);

describe("ShoppingView 'Lista ürítése'", () => {
  it("is disabled while the list is empty", () => {
    render(<ShoppingView {...baseProps} />);
    expect(clearAllButton().disabled).toBe(true);
  });

  it("stays enabled when a search hides every group but items remain", () => {
    render(<ShoppingView {...baseProps} groups={[]} openCount={3} doneCount={1} />);
    expect(clearAllButton().disabled).toBe(false);
  });

  it("is enabled when only bought items are left", () => {
    render(<ShoppingView {...baseProps} openCount={0} doneCount={2} />);
    expect(clearAllButton().disabled).toBe(false);
  });

  it("calls onClearAll when pressed", () => {
    const onClearAll = vi.fn();
    render(<ShoppingView {...baseProps} openCount={2} onClearAll={onClearAll} />);
    fireEvent.click(clearAllButton());
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("renders the button on mobile too", () => {
    render(<ShoppingView {...baseProps} isMobile openCount={1} />);
    expect(clearAllButton().disabled).toBe(false);
  });
});
