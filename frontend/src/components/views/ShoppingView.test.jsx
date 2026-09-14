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

// The recommendations card carries the same catalog thumbnails as the real list
// rows. It needs them more, in fact: these are items the user has never added,
// so the picture is most of what makes the card scannable at a glance.
//
// A recommendation is a raw catalog entry, so its `key` is already the
// normalized key the image convention is named after -- no enrichment step in
// between, unlike the list rows.
const recProps = {
  ...baseProps,
  recommendations: {
    essential: [{ key: "tej", name: "tej", category: "Tejtermékek" }],
    goodToHave: [
      { key: "vaj margarin", name: "vaj / margarin", category: "Tejtermékek" },
    ],
    extra: [],
  },
};

const recThumbSrcs = () =>
  Array.from(document.querySelectorAll(".rec-row-thumb")).map((img) =>
    img.getAttribute("src"),
  );

const moreButton = () =>
  screen.getByRole("button", { name: /További ajánlott tételek/ });

describe("ShoppingView recommendations", () => {
  it("shows the catalog thumbnail beside a missing staple", () => {
    render(<ShoppingView {...recProps} />);
    expect(recThumbSrcs()).toEqual(["/pantry/tej.png"]);
  });

  it("covers the items behind 'További ajánlott tételek' as well", () => {
    render(<ShoppingView {...recProps} />);
    fireEvent.click(moreButton());
    expect(recThumbSrcs()).toEqual([
      "/pantry/tej.png",
      "/pantry/vaj-margarin.png",
    ]);
  });

  it("prefers an explicit imageUrl from the catalog", () => {
    render(
      <ShoppingView
        {...recProps}
        recommendations={{
          ...recProps.recommendations,
          essential: [
            {
              key: "tej",
              name: "tej",
              category: "Tejtermékek",
              imageUrl: "https://cdn/x/milk.webp",
            },
          ],
        }}
      />,
    );
    expect(recThumbSrcs()).toEqual(["https://cdn/x/milk.webp"]);
  });

  it("drops the pictures on a phone, as the list rows do", () => {
    render(<ShoppingView {...recProps} isMobile />);

    expect(recThumbSrcs()).toEqual([]);
    expect(screen.getByText("tej")).toBeTruthy();
  });

  it("drops an image that fails to load, leaving the row addable", () => {
    const onAddItem = vi.fn();
    render(<ShoppingView {...recProps} onAddItem={onAddItem} />);

    fireEvent.error(document.querySelector(".rec-row-thumb"));

    expect(recThumbSrcs()).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "tej a listára" }));
    expect(onAddItem).toHaveBeenCalledTimes(1);
  });
});
