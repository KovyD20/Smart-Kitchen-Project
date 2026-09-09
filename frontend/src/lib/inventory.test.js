import { describe, it, expect } from "vitest";
import { shoppingRowNote } from "./inventory.js";

describe("shoppingRowNote", () => {
  it("shows the recipes' total where rounding moved the amount", () => {
    expect(
      shoppingRowNote({ amount: 1, unit: "kg", sourceAmount: 500, sourceUnit: "g" }),
    ).toBe("recept: 500 g");
  });

  it("stays quiet when the total explains nothing", () => {
    // "10 db" under "10 db" is noise.
    expect(
      shoppingRowNote({ amount: 10, unit: "db", sourceAmount: 10, sourceUnit: "db" }),
    ).toBeNull();
    expect(shoppingRowNote({ amount: 3, unit: "csokor" })).toBeNull();
    expect(shoppingRowNote({})).toBeNull();
    expect(shoppingRowNote(null)).toBeNull();
  });

  it("shows the words the resolver dropped from the recipe's wording", () => {
    expect(shoppingRowNote({ amount: 50, unit: "g", notes: ["reszelt"] })).toBe(
      "reszelt",
    );
  });

  it("puts the modifiers before the quantity note, on one line", () => {
    expect(
      shoppingRowNote({
        amount: 1,
        unit: "kg",
        sourceAmount: 500,
        sourceUnit: "g",
        notes: ["reszelt", "olvasztott"],
      }),
    ).toBe("reszelt · olvasztott · recept: 500 g");
  });

  it("ignores a zero or unusable source amount", () => {
    expect(shoppingRowNote({ amount: 1, unit: "kg", sourceAmount: 0 })).toBeNull();
    expect(
      shoppingRowNote({ amount: 1, unit: "kg", sourceAmount: "abc", notes: ["friss"] }),
    ).toBe("friss");
  });

  it("keeps a loose-only row's note to the modifiers", () => {
    // A pinch of salt against a kilo bag: sourceAmount is 0 and sourceLoose is
    // what carries the meaning, so there is no quantity worth printing.
    expect(
      shoppingRowNote({
        amount: 1,
        unit: "kg",
        sourceAmount: 0,
        sourceUnit: "",
        sourceLoose: true,
        notes: ["őrölt"],
      }),
    ).toBe("őrölt");
  });
});
