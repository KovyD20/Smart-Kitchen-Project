// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import CookMode from "./CookMode";

// The peek at the next step is the only part of cook mode that reads ahead in
// the recipe, so the off-by-one it could carry is worth pinning down: what it
// shows must be the step the "Következő lépés" button actually goes to.
const STEPS = [
  "Hámozd meg a krumplit.",
  "Vágd fel a hagymát.",
  "Pirítsd meg a hagymát.",
];

const baseProps = {
  recipeName: "Rakott krumpli",
  steps: STEPS,
  ingredients: [],
  step: 0,
  isMobile: false,
  onStep: () => {},
  onClose: () => {},
};

const peek = () => document.querySelector(".cook-peek");
const peekText = () => document.querySelector(".cook-peek-text")?.textContent;

afterEach(cleanup);

describe("CookMode next-step peek", () => {
  it("shows the step that comes after the current one", () => {
    render(<CookMode {...baseProps} step={0} />);

    expect(screen.getByText(STEPS[0])).toBeTruthy();
    expect(peekText()).toBe(STEPS[1]);
    expect(document.querySelector(".cook-peek-label").textContent).toContain(
      "2. lépés",
    );
  });

  it("follows the current step", () => {
    render(<CookMode {...baseProps} step={1} />);
    expect(peekText()).toBe(STEPS[2]);
  });

  it("steps forward when pressed, like the button below it", () => {
    const onStep = vi.fn();
    render(<CookMode {...baseProps} step={0} onStep={onStep} />);

    fireEvent.click(peek());

    expect(onStep).toHaveBeenCalledWith(1);
  });

  it("keeps the slot on the last step, with nothing to go to", () => {
    render(<CookMode {...baseProps} step={2} />);

    // Still there -- the slot holds its height so the step text and the buttons
    // do not jump at the end of every recipe -- but no longer a control.
    expect(peek()).not.toBeNull();
    expect(peek().tagName).toBe("DIV");
    expect(screen.getByText("Ez az utolsó lépés")).toBeTruthy();
  });

  it("treats a one-step recipe as the last step", () => {
    render(<CookMode {...baseProps} steps={[STEPS[0]]} step={0} />);

    expect(peek().tagName).toBe("DIV");
    expect(screen.getByText("Ez az utolsó lépés")).toBeTruthy();
  });

  it("clamps a step index past the end instead of reading off the array", () => {
    render(<CookMode {...baseProps} step={99} />);

    expect(screen.getByText(STEPS[2])).toBeTruthy();
    expect(peek().tagName).toBe("DIV");
  });
});
