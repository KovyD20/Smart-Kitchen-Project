// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useFocusTrap } from "./useFocusTrap";

function Dialog({ onEscape }) {
  const ref = useFocusTrap(true, { onEscape });
  return (
    <div ref={ref} tabIndex={-1} data-testid="dialog">
      <button type="button">első</button>
      <button type="button">utolsó</button>
    </div>
  );
}

function Harness({ open, onEscape }) {
  return (
    <div>
      <button type="button">nyitó</button>
      {open && <Dialog onEscape={onEscape} />}
    </div>
  );
}

const btn = (name) => screen.getByRole("button", { name });

afterEach(cleanup);

describe("useFocusTrap", () => {
  it("moves focus to the first control on open", () => {
    render(<Harness open />);
    expect(document.activeElement).toBe(btn("első"));
  });

  it("wraps Tab at both ends", () => {
    render(<Harness open />);
    fireEvent.keyDown(btn("első"), { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(btn("utolsó"));
    fireEvent.keyDown(btn("utolsó"), { key: "Tab" });
    expect(document.activeElement).toBe(btn("első"));
  });

  it("calls onEscape and stops the layer below from seeing the key", () => {
    const onEscape = vi.fn();
    const onWindowKey = vi.fn();
    window.addEventListener("keydown", onWindowKey);
    render(<Harness open onEscape={onEscape} />);

    fireEvent.keyDown(btn("első"), { key: "Escape" });
    window.removeEventListener("keydown", onWindowKey);

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onWindowKey).not.toHaveBeenCalled();
  });

  it("hands focus back to whatever opened it", () => {
    const { rerender } = render(<Harness open={false} />);
    btn("nyitó").focus();
    rerender(<Harness open />);
    expect(document.activeElement).toBe(btn("első"));

    rerender(<Harness open={false} />);
    expect(document.activeElement).toBe(btn("nyitó"));
  });
});
