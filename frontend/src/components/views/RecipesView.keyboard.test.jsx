// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import RecipesView from "./RecipesView";

// The recipe grid is four cards per row on desktop, so document order is not
// the visual order: Right has to reach the next card, not the one below. jsdom
// does no layout, so the cards are placed by hand, in the geometry Chrome
// reports at 1920x1080.
const COLUMNS = [
  [26, 481],
  [497, 952],
  [968, 1423],
  [1439, 1894],
];
const ROWS = [
  [192, 412],
  [428, 648],
];

const recipes = Array.from({ length: 8 }, (_, i) => ({
  id: `r${i}`,
  name: `Recept ${i}`,
  ingredients: [],
  steps: [],
}));

const baseProps = {
  recipes,
  totalCount: recipes.length,
  selectedId: null,
  filterTag: "all",
  allTags: [],
  search: "",
  isMobile: false,
  sortMode: "name",
  fridge: [],
  onSortChange: () => {},
  onFilterChange: () => {},
  onSearchChange: () => {},
  onSelectRecipe: () => {},
};

const card = (i) => screen.getByRole("button", { name: new RegExp(`Recept ${i}`) });

const layOutGrid = () => {
  recipes.forEach((_, i) => {
    const [x1, x2] = COLUMNS[i % 4];
    const [y1, y2] = ROWS[Math.floor(i / 4)];
    card(i).getBoundingClientRect = () => ({
      left: x1,
      top: y1,
      right: x2,
      bottom: y2,
      width: x2 - x1,
      height: y2 - y1,
      x: x1,
      y: y1,
    });
  });
};

afterEach(cleanup);

describe("RecipesView keyboard navigation", () => {
  const setup = (props = {}) => {
    render(<RecipesView {...baseProps} {...props} />);
    layOutGrid();
  };

  it("moves along the row with the horizontal arrows", () => {
    setup();
    card(0).focus();
    fireEvent.keyDown(card(0), { key: "ArrowRight" });
    expect(document.activeElement).toBe(card(1));
    fireEvent.keyDown(card(1), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(card(0));
  });

  it("moves to the card directly below, not the next one in the document", () => {
    setup();
    card(1).focus();
    fireEvent.keyDown(card(1), { key: "ArrowDown" });
    expect(document.activeElement).toBe(card(5));
  });

  it("leaves the edges of the grid unhandled, so the focus can walk out", () => {
    setup();
    card(0).focus();
    const event = new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      bubbles: true,
      cancelable: true,
    });
    card(0).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(card(0));
  });

  it("keeps one tab stop for the whole grid", () => {
    setup();
    const stops = recipes.filter((_, i) => card(i).tabIndex === 0);
    expect(stops).toHaveLength(1);

    fireEvent.focus(card(3));
    expect(card(3).tabIndex).toBe(0);
    expect(card(0).tabIndex).toBe(-1);
  });

  it("favourites the focused recipe with 'f'", () => {
    const onToggleFavorite = vi.fn();
    setup({ onToggleFavorite });
    fireEvent.keyDown(card(2), { key: "f" });
    expect(onToggleFavorite).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r2" }),
    );
  });

  it("opens the focused recipe with Enter", () => {
    const onSelectRecipe = vi.fn();
    setup({ onSelectRecipe });
    // The card is a real button, so Enter activates it the browser's way.
    fireEvent.click(card(4));
    expect(onSelectRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r4" }),
    );
  });
});
