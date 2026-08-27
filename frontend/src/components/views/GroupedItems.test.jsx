// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ItemRow } from "./GroupedItems";

// jsdom never loads images, so the thumbnail's success path is asserted through
// the rendered src and the failure path by firing the error event by hand —
// which is the branch that matters, since the asset set is deliberately partial.
const noop = () => {};
const baseProps = {
  name: "tej",
  qtyLabel: "1 l",
  onIncrement: noop,
  onDecrement: noop,
  onDelete: noop,
};

const thumb = () => document.querySelector(".item-thumb");

afterEach(cleanup);

describe("ItemRow thumbnail", () => {
  it("renders the conventional path for a catalog key", () => {
    render(<ItemRow {...baseProps} nameKey="tej" />);
    expect(thumb().getAttribute("src")).toBe("/pantry/tej.webp");
  });

  it("slugs a multi-word key", () => {
    render(<ItemRow {...baseProps} name="vaj / margarin" nameKey="vaj margarin" />);
    expect(thumb().getAttribute("src")).toBe("/pantry/vaj-margarin.webp");
  });

  it("prefers an explicit imageUrl", () => {
    render(
      <ItemRow {...baseProps} nameKey="tej" imageUrl="https://cdn/x/milk.webp" />,
    );
    expect(thumb().getAttribute("src")).toBe("https://cdn/x/milk.webp");
  });

  it("drops the image when it fails to load, leaving the row intact", () => {
    render(<ItemRow {...baseProps} nameKey="nincs ilyen" />);
    expect(thumb()).not.toBeNull();

    fireEvent.error(thumb());

    expect(thumb()).toBeNull();
    expect(screen.getByText("tej")).toBeTruthy();
  });

  it("renders no image when the item has no key", () => {
    render(<ItemRow {...baseProps} nameKey="" />);
    expect(thumb()).toBeNull();
  });

  it("renders no image on mobile (showThumb=false)", () => {
    render(<ItemRow {...baseProps} nameKey="tej" showThumb={false} />);
    expect(thumb()).toBeNull();
  });

  it("marks the thumbnail decorative, so the name is the only label", () => {
    render(<ItemRow {...baseProps} nameKey="tej" />);
    expect(thumb().getAttribute("alt")).toBe("");
    expect(thumb().getAttribute("aria-hidden")).toBe("true");
    expect(thumb().getAttribute("loading")).toBe("lazy");
  });
});
