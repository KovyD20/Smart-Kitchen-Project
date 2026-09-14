// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render } from "@testing-library/react";
import RecipesView from "./RecipesView";

// The card carries two kinds of tag and has to keep them apart: the course,
// which is one of five known names and keeps its colour, and whatever the user
// added themselves, which stays grey so the card still reads course-first.
const recipe = (tags) => ({
  id: "r1",
  name: "Bolognai",
  tags,
  ingredients: [],
  steps: [],
});

const baseProps = {
  totalCount: 1,
  selectedId: null,
  filterTag: "all",
  allTags: [],
  search: "",
  isMobile: false,
  sortMode: "course",
  onSortChange: () => {},
  onFilterChange: () => {},
  onSearchChange: () => {},
  onSelectRecipe: () => {},
};

const pills = () =>
  Array.from(document.querySelectorAll(".tag-pill")).map((node) => ({
    text: node.textContent,
    own: node.classList.contains("is-own"),
  }));

afterEach(cleanup);

describe("RecipesView card tags", () => {
  it("shows the course in colour and the user's own tags in grey", () => {
    render(
      <RecipesView {...baseProps} recipes={[recipe(["főétel", "csirke", "gyors"])]} />,
    );

    expect(pills()).toEqual([
      { text: "főétel", own: false },
      { text: "csirke", own: true },
      { text: "gyors", own: true },
    ]);
  });

  it("shows own tags even on a recipe saved before courses existed", () => {
    render(<RecipesView {...baseProps} recipes={[recipe(["need to try"])]} />);
    expect(pills()).toEqual([{ text: "need to try", own: true }]);
  });

  it("caps the row so one over-tagged recipe cannot grow its card", () => {
    render(
      <RecipesView
        {...baseProps}
        recipes={[recipe(["leves", "a", "b", "c", "d", "e"])]}
      />,
    );
    expect(pills()).toHaveLength(4);
  });

  it("keeps a phone row to the course and one tag", () => {
    render(
      <RecipesView {...baseProps} isMobile recipes={[recipe(["leves", "a", "b"])]} />,
    );
    expect(pills()).toEqual([
      { text: "leves", own: false },
      { text: "a", own: true },
    ]);
  });

  it("renders nothing when the recipe has no tags at all", () => {
    render(<RecipesView {...baseProps} recipes={[recipe([])]} />);
    expect(pills()).toEqual([]);
  });
});

// Category is what the list opens on, so it is also the chip that comes first.
describe("RecipesView sort row", () => {
  it("offers category before name", () => {
    render(<RecipesView {...baseProps} recipes={[recipe(["leves"])]} />);

    const labels = Array.from(
      document.querySelectorAll(".sort-row .chip"),
    ).map((node) => node.textContent);

    expect(labels).toEqual(["Kategória szerint", "Név szerint", "Ami megvan"]);
  });
});
