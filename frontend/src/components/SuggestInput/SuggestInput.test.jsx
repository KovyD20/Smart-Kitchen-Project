// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import SuggestInput from "./SuggestInput";
import {
  buildSuggestionIndex,
  searchSuggestions,
} from "../../lib/catalogSearch";

const entry = (key, name, category, priority = "extra") => ({
  key,
  name,
  category,
  priority,
  purchase: null,
  imageUrl: null,
});

const ENTRIES = [
  entry("kenyer", "kenyér", "Pékáru", "essential"),
  entry("kefir", "kefir", "Tejtermékek", "good_to_have"),
  entry("natur kefir", "natúr kefir", "Tejtermékek"),
  entry("burgonya", "burgonya", "Zöldségek", "good_to_have"),
];
const ALIASES = new Map([["krumpli", ENTRIES[3]]]);
const index = buildSuggestionIndex(ENTRIES, ALIASES);
const suggest = (query) => searchSuggestions(index, query);

// The field is controlled by its parent, so the test needs one -- otherwise
// typing never changes `value` and the list never moves.
function Harness({ onSelect = () => {}, onKeyDown, plain = false }) {
  const [value, setValue] = useState("");
  return (
    <SuggestInput
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onSelect={onSelect}
      onKeyDown={onKeyDown}
      // `plain` rather than a suggest prop defaulting to undefined: a default
      // parameter would swallow exactly the case being tested.
      suggest={plain ? undefined : suggest}
      placeholder="Tétel hozzáadása"
    />
  );
}

const field = () => screen.getByPlaceholderText("Tétel hozzáadása");
const type = (text) => fireEvent.change(field(), { target: { value: text } });
const options = () => screen.queryAllByRole("option");
const names = () => options().map((node) => node.textContent);
const press = (key) => fireEvent.keyDown(field(), { key });

afterEach(cleanup);

describe("SuggestInput", () => {
  it("stays closed until something is typed", () => {
    render(<Harness />);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(field().getAttribute("aria-expanded")).toBe("false");
  });

  it("offers the matching items as soon as two letters are in", () => {
    render(<Harness />);
    type("ke");

    expect(names().some((text) => text.includes("kenyér"))).toBe(true);
    expect(names().some((text) => text.includes("natúr kefir"))).toBe(true);
    expect(field().getAttribute("aria-expanded")).toBe("true");
  });

  it("closes again when nothing matches", () => {
    render(<Harness />);
    type("ke");
    type("kezelhetetlen");

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("highlights with the arrows and points the field at the active row", () => {
    render(<Harness />);
    type("ke");

    // Nothing is highlighted until an arrow is pressed -- that is what keeps
    // Enter free for submitting a typed-out name.
    expect(field().getAttribute("aria-activedescendant")).toBeNull();
    expect(options()[0].getAttribute("aria-selected")).toBe("false");

    press("ArrowDown");
    expect(options()[0].getAttribute("aria-selected")).toBe("true");
    expect(field().getAttribute("aria-activedescendant")).toBe(
      options()[0].getAttribute("id"),
    );

    press("ArrowDown");
    expect(options()[1].getAttribute("aria-selected")).toBe("true");
  });

  it("wraps around at both ends of the list", () => {
    render(<Harness />);
    type("ke");
    const last = options().length - 1;

    press("ArrowUp");
    expect(options()[last].getAttribute("aria-selected")).toBe("true");

    press("ArrowDown");
    expect(options()[0].getAttribute("aria-selected")).toBe("true");
  });

  it("picks the highlighted item with Enter and does not also submit", () => {
    const onSelect = vi.fn();
    const onKeyDown = vi.fn();
    render(<Harness onSelect={onSelect} onKeyDown={onKeyDown} />);

    type("ke");
    press("ArrowDown");
    press("Enter");

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].name).toBe("kenyér");
    expect(onKeyDown).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("leaves Enter to the caller while nothing is highlighted", () => {
    const onSelect = vi.fn();
    const onKeyDown = vi.fn();
    render(<Harness onSelect={onSelect} onKeyDown={onKeyDown} />);

    type("ke");
    press("Enter");

    expect(onSelect).not.toHaveBeenCalled();
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it("picks an item on a tap", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);

    type("ke");
    fireEvent.click(
      options().find((node) => node.textContent.includes("natúr kefir")),
    );

    expect(onSelect.mock.calls[0][0].name).toBe("natúr kefir");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("drops the highlight when the query changes under it", () => {
    const onSelect = vi.fn();
    const onKeyDown = vi.fn();
    render(<Harness onSelect={onSelect} onKeyDown={onKeyDown} />);

    type("ke");
    press("ArrowDown");
    type("kef");
    press("Enter");

    expect(onSelect).not.toHaveBeenCalled();
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and marks the key as spent", () => {
    render(<Harness />);
    type("ke");

    const escape = fireEvent.keyDown(field(), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    // fireEvent returns false when preventDefault was called: the app-wide
    // Escape handler must not also fire and close the view behind the field.
    expect(escape).toBe(false);
  });

  it("lets Escape through when there is no list to close", () => {
    render(<Harness />);
    expect(fireEvent.keyDown(field(), { key: "Escape" })).toBe(true);
  });

  it("closes on blur", () => {
    render(<Harness />);
    type("ke");
    fireEvent.blur(field());

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("names the alias that brought an item in", () => {
    render(<Harness />);
    type("krum");

    expect(options()).toHaveLength(1);
    expect(options()[0].textContent).toContain("burgonya");
    expect(options()[0].textContent).toContain("krumpli");
  });

  it("is a plain text field without a suggest function", () => {
    render(<Harness plain />);
    type("ke");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(field().value).toBe("ke");
  });
});
