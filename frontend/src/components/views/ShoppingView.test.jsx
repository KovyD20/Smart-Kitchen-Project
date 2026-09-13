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

// End to end through the view: the toggle in the header is what arms the dots
// down in the cards, and nothing else in the view should turn them on.
const groupsWithOneItem = [
  {
    category: "Zöldségek",
    items: [{ id: "1", name: "sárgarépa", amount: 2, unit: "db", done: false }],
  },
];

const colorProps = {
  ...baseProps,
  groups: groupsWithOneItem,
  openCount: 1,
  colorFor: () => "#ffcc00",
  onCategoryColorChange: () => {},
};

const colorToggle = () =>
  screen.queryByRole("button", { name: "Színek szerkesztése" });
const categoryDot = () =>
  screen.getByLabelText("Zöldségek színének módosítása");

describe("ShoppingView colour edit mode", () => {
  it("leaves the dots inert until the toggle is pressed", () => {
    render(<ShoppingView {...colorProps} />);

    expect(categoryDot().disabled).toBe(true);
    fireEvent.click(colorToggle());
    expect(categoryDot().disabled).toBe(false);
  });

  it("offers no toggle when the view cannot change colours", () => {
    render(<ShoppingView {...colorProps} onCategoryColorChange={undefined} />);
    expect(colorToggle()).toBeNull();
  });

  it("offers no toggle while there is no category on screen", () => {
    render(<ShoppingView {...colorProps} groups={[]} />);
    expect(colorToggle()).toBeNull();
  });

  it("works from the mobile tools row too", () => {
    render(<ShoppingView {...colorProps} isMobile />);

    expect(categoryDot().disabled).toBe(true);
    fireEvent.click(colorToggle());
    expect(categoryDot().disabled).toBe(false);
  });
});
