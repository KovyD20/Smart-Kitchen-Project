// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
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
    expect(thumb().getAttribute("src")).toBe("/pantry/tej.avif");
  });

  it("slugs a multi-word key", () => {
    render(<ItemRow {...baseProps} name="vaj / margarin" nameKey="vaj margarin" />);
    expect(thumb().getAttribute("src")).toBe("/pantry/vaj-margarin.avif");
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

const editable = (props) => ({
  ...baseProps,
  amount: 2,
  unit: "l",
  units: ["db", "g", "l"],
  ...props,
});

const amountField = () => screen.getByLabelText("Mennyiség");
const unitSelect = () => screen.getByLabelText("Mértékegység");
const editButton = () =>
  screen.getByLabelText("tej mennyiségének módosítása");
// Every editing assertion goes through the pencil: the fields do not exist
// until the row is switched into edit mode.
const startEdit = () => fireEvent.click(editButton());

describe("ItemRow edit toggle", () => {
  it("offers no pencil when the row has no edit handler", () => {
    render(<ItemRow {...baseProps} />);
    expect(screen.getByText("1 l")).toBeTruthy();
    expect(screen.queryByLabelText("tej mennyiségének módosítása")).toBeNull();
  });

  it("shows the plain label until the pencil is pressed", () => {
    render(<ItemRow {...editable({ onAmountChange: vi.fn(), onUnitChange: vi.fn() })} />);

    expect(screen.getByText("1 l")).toBeTruthy();
    expect(screen.queryByLabelText("Mennyiség")).toBeNull();
    expect(screen.queryByLabelText("Mértékegység")).toBeNull();

    startEdit();

    expect(screen.queryByText("1 l")).toBeNull();
    expect(amountField()).toBeTruthy();
    expect(unitSelect()).toBeTruthy();
  });

  it("puts the caret in the amount field it just revealed", () => {
    render(<ItemRow {...editable({ onAmountChange: vi.fn() })} />);
    startEdit();
    expect(document.activeElement).toBe(amountField());
  });

  it("closes again on a second press", () => {
    render(<ItemRow {...editable({ onAmountChange: vi.fn() })} />);
    startEdit();
    fireEvent.click(editButton());

    expect(screen.queryByLabelText("Mennyiség")).toBeNull();
    expect(screen.getByText("1 l")).toBeTruthy();
  });

  it("closes on Enter and on Escape", () => {
    render(<ItemRow {...editable({ onAmountChange: vi.fn() })} />);

    startEdit();
    fireEvent.keyDown(amountField(), { key: "Enter" });
    expect(screen.queryByLabelText("Mennyiség")).toBeNull();

    startEdit();
    fireEvent.keyDown(amountField(), { key: "Escape" });
    expect(screen.queryByLabelText("Mennyiség")).toBeNull();
  });

  it("edits only the row whose pencil was pressed", () => {
    render(
      <>
        <ItemRow {...editable({ onAmountChange: vi.fn() })} />
        <ItemRow {...editable({ name: "vaj", onAmountChange: vi.fn() })} />
      </>,
    );

    startEdit();

    // One field, not two: the other row is untouched.
    expect(screen.getAllByLabelText("Mennyiség")).toHaveLength(1);
  });
});

describe("ItemRow amount and unit editing", () => {
  it("commits a typed amount on blur", () => {
    const onAmountChange = vi.fn();
    render(<ItemRow {...editable({ onAmountChange })} />);
    startEdit();

    fireEvent.change(amountField(), { target: { value: "150" } });
    // Nothing is written while the field is still being typed into.
    expect(onAmountChange).not.toHaveBeenCalled();

    fireEvent.blur(amountField());
    expect(onAmountChange).toHaveBeenCalledWith(150);
  });

  it("commits on Enter", () => {
    const onAmountChange = vi.fn();
    render(<ItemRow {...editable({ onAmountChange })} />);
    startEdit();

    fireEvent.change(amountField(), { target: { value: "7" } });
    fireEvent.keyDown(amountField(), { key: "Enter" });

    expect(onAmountChange).toHaveBeenCalledWith(7);
  });

  it("abandons the edit on Escape", () => {
    const onAmountChange = vi.fn();
    render(<ItemRow {...editable({ onAmountChange })} />);
    startEdit();

    fireEvent.change(amountField(), { target: { value: "99" } });
    fireEvent.keyDown(amountField(), { key: "Escape" });

    // Closed and nothing written -- the typed 99 is gone.
    expect(screen.queryByLabelText("Mennyiség")).toBeNull();
    expect(onAmountChange).not.toHaveBeenCalled();
  });

  it("writes nothing for a zero, a blank or an unchanged amount", () => {
    const onAmountChange = vi.fn();
    render(<ItemRow {...editable({ onAmountChange })} />);
    startEdit();

    for (const value of ["0", "", "-3", "2"]) {
      fireEvent.change(amountField(), { target: { value } });
      fireEvent.blur(amountField());
    }

    expect(onAmountChange).not.toHaveBeenCalled();
  });

  it("follows the stored amount again once the edit is committed", () => {
    const { rerender } = render(<ItemRow {...editable({ onAmountChange: vi.fn() })} />);
    startEdit();
    fireEvent.change(amountField(), { target: { value: "5" } });
    fireEvent.blur(amountField());

    // What the +/- buttons (or another device) would push down.
    rerender(<ItemRow {...editable({ amount: 5, onAmountChange: vi.fn() })} />);
    expect(amountField().value).toBe("5");
    // Blur commits but leaves edit mode open, so the unit can be fixed too.
    expect(screen.queryByText("1 l")).toBeNull();
  });

  it("reports the picked unit", () => {
    const onUnitChange = vi.fn();
    render(<ItemRow {...editable({ onUnitChange })} />);
    startEdit();

    fireEvent.change(unitSelect(), { target: { value: "g" } });
    expect(onUnitChange).toHaveBeenCalledWith("g");
  });

  it("keeps a unit that is not on the list selectable", () => {
    render(<ItemRow {...editable({ unit: "zacskó", onUnitChange: vi.fn() })} />);
    startEdit();

    expect(unitSelect().value).toBe("zacskó");
    expect(
      [...unitSelect().options].map((option) => option.value),
    ).toEqual(["zacskó", "db", "g", "l"]);
  });
});
