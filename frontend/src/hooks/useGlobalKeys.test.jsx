// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useGlobalKeys } from "./useGlobalKeys";

const TAB_IDS = ["receptek", "recept", "lista", "huto", "uj"];

function Harness(props) {
  useGlobalKeys({ tabIds: TAB_IDS, ...props });
  return (
    <div>
      <input aria-label="mezo" />
      <button type="button">gomb</button>
    </div>
  );
}

const setup = (props = {}) => {
  const handlers = {
    onSelectTab: vi.fn(),
    onFocusSearch: vi.fn(),
    onToggleHelp: vi.fn(),
    onEscape: vi.fn(() => true),
    ...props,
  };
  render(<Harness {...handlers} />);
  return {
    ...handlers,
    input: screen.getByLabelText("mezo"),
    button: screen.getByRole("button"),
  };
};

afterEach(cleanup);

describe("useGlobalKeys", () => {
  it("switches tabs on Alt+<digit>, by TABS order", () => {
    const { onSelectTab, button } = setup();
    fireEvent.keyDown(button, { key: "3", code: "Digit3", altKey: true });
    expect(onSelectTab).toHaveBeenCalledWith("lista");
  });

  it("ignores an Alt+digit beyond the last tab", () => {
    const { onSelectTab, button } = setup();
    fireEvent.keyDown(button, { key: "9", code: "Digit9", altKey: true });
    expect(onSelectTab).not.toHaveBeenCalled();
  });

  it("focuses the search on '/' and on Ctrl+K", () => {
    const { onFocusSearch, button } = setup();
    fireEvent.keyDown(button, { key: "/" });
    fireEvent.keyDown(button, { key: "k", ctrlKey: true });
    expect(onFocusSearch).toHaveBeenCalledTimes(2);
  });

  it("opens the cheat sheet on '?'", () => {
    const { onToggleHelp, button } = setup();
    fireEvent.keyDown(button, { key: "?", shiftKey: true });
    expect(onToggleHelp).toHaveBeenCalledTimes(1);
  });

  // The whole reason lib/keyboard exists: typing "dió" must not trigger the
  // shortcuts hidden behind those letters.
  it("does not fire while the user is typing", () => {
    const { onFocusSearch, onToggleHelp, input } = setup();
    fireEvent.keyDown(input, { key: "/" });
    fireEvent.keyDown(input, { key: "?", shiftKey: true });
    expect(onFocusSearch).not.toHaveBeenCalled();
    expect(onToggleHelp).not.toHaveBeenCalled();
  });

  it("still switches tabs from inside a field (Alt is unambiguous)", () => {
    const { onSelectTab, input } = setup();
    fireEvent.keyDown(input, { key: "1", code: "Digit1", altKey: true });
    expect(onSelectTab).toHaveBeenCalledWith("receptek");
  });

  it("closes a layer with Escape even while typing", () => {
    const { onEscape, input } = setup();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("leaves a key a lower layer already handled alone", () => {
    const { onEscape, button } = setup();
    // What the confirm dialog and every focus trap do before this listener runs.
    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    event.preventDefault();
    button.dispatchEvent(event);
    expect(onEscape).not.toHaveBeenCalled();
  });
});
