import { describe, it, expect, vi, afterEach } from "vitest";
import {
  normalizeUnit,
  unitInfo,
  areUnitsCompatible,
  convertAmount,
  stripAmountsAndUnits,
  toPurchaseAmount,
} from "./units.js";

describe("normalizeUnit", () => {
  it("maps aliases to their canonical short form", () => {
    expect(normalizeUnit("g")).toBe("g");
    expect(normalizeUnit("gramm")).toBe("g");
    expect(normalizeUnit("darab")).toBe("db");
  });

  it("strips dots and surrounding whitespace/hyphens", () => {
    expect(normalizeUnit("ml.")).toBe("ml");
    expect(normalizeUnit("  kg ")).toBe("kg");
  });

  it("returns the cleaned value for unknown units, and empty for empty input", () => {
    expect(normalizeUnit("xyz")).toBe("xyz");
    expect(normalizeUnit("")).toBe("");
  });
});

describe("unitInfo", () => {
  it("returns kind and factor for known units", () => {
    expect(unitInfo("g")).toEqual({ unit: "g", kind: "mass", factor: 1 });
    expect(unitInfo("kg")).toEqual({ unit: "kg", kind: "mass", factor: 1000 });
    expect(unitInfo("l")).toEqual({ unit: "l", kind: "volume", factor: 1000 });
    expect(unitInfo("db")).toEqual({ unit: "db", kind: "count", factor: 1 });
  });

  it("returns only the unit for unknown units (no kind/factor)", () => {
    expect(unitInfo("xyz")).toEqual({ unit: "xyz" });
  });
});

describe("areUnitsCompatible", () => {
  it("is true for the same unit", () => {
    expect(areUnitsCompatible(unitInfo("g"), unitInfo("g"))).toBe(true);
    expect(areUnitsCompatible(unitInfo("db"), unitInfo("db"))).toBe(true);
  });

  it("is true within the same measurable kind (mass/volume)", () => {
    expect(areUnitsCompatible(unitInfo("g"), unitInfo("kg"))).toBe(true);
    expect(areUnitsCompatible(unitInfo("ml"), unitInfo("l"))).toBe(true);
  });

  it("is false across different kinds or when a kind is missing", () => {
    expect(areUnitsCompatible(unitInfo("g"), unitInfo("ml"))).toBe(false);
    expect(areUnitsCompatible(unitInfo("g"), unitInfo("xyz"))).toBe(false);
  });
});

describe("convertAmount", () => {
  it("converts between compatible units", () => {
    expect(convertAmount(1000, unitInfo("g"), unitInfo("kg"))).toBe(1);
    expect(convertAmount(1, unitInfo("dkg"), unitInfo("g"))).toBe(10);
  });

  it("returns the amount unchanged for same or incompatible units", () => {
    expect(convertAmount(7, unitInfo("g"), unitInfo("g"))).toBe(7);
    expect(convertAmount(5, unitInfo("g"), unitInfo("ml"))).toBe(5);
  });

  it("handles zero and negative amounts", () => {
    expect(convertAmount(0, unitInfo("g"), unitInfo("kg"))).toBe(0);
    expect(convertAmount(-2000, unitInfo("g"), unitInfo("kg"))).toBe(-2);
  });
});

describe("stripAmountsAndUnits", () => {
  it("removes embedded amounts and unit tokens", () => {
    expect(stripAmountsAndUnits("2 kg liszt")).toBe("liszt");
    expect(stripAmountsAndUnits("3db tojás")).toBe("tojas");
  });

  it("lowercases and strips accents", () => {
    expect(stripAmountsAndUnits("Vöröshagyma")).toBe("voroshagyma");
  });
});

describe("toPurchaseAmount", () => {
  const KILO = { unit: "kg", amount: 1 };
  const TEN_EGGS = { unit: "db", amount: 10 };
  const BUTTER = { unit: "g", amount: 250 };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rounds a convertible amount up to the next whole package", () => {
    expect(toPurchaseAmount(500, "g", KILO)).toEqual({
      amount: 1,
      unit: "kg",
      rounded: true,
    });
    expect(toPurchaseAmount(1200, "g", KILO)).toEqual({
      amount: 2,
      unit: "kg",
      rounded: true,
    });
    expect(toPurchaseAmount(300, "g", BUTTER)).toEqual({
      amount: 500,
      unit: "g",
      rounded: true,
    });
  });

  it("keeps an exact package multiple as-is, and reports it as not rounded", () => {
    expect(toPurchaseAmount(250, "g", BUTTER)).toEqual({
      amount: 250,
      unit: "g",
      rounded: false,
    });
    expect(toPurchaseAmount(10, "db", TEN_EGGS)).toEqual({
      amount: 10,
      unit: "db",
      rounded: false,
    });
  });

  it("converts an exact kilo without float dust", () => {
    expect(toPurchaseAmount(1000, "g", KILO)).toEqual({
      amount: 1,
      unit: "kg",
      rounded: true,
    });
  });

  it("rounds counts up to a whole package", () => {
    expect(toPurchaseAmount(3, "db", TEN_EGGS)).toEqual({
      amount: 10,
      unit: "db",
      rounded: true,
    });
    expect(toPurchaseAmount(12, "db", TEN_EGGS)).toEqual({
      amount: 20,
      unit: "db",
      rounded: true,
    });
  });

  it("returns a single package for units that cannot be converted", () => {
    // The shop has no teaspoon of sugar, and no marék of flour either.
    expect(toPurchaseAmount(2, "tk", KILO)).toEqual({
      amount: 1,
      unit: "kg",
      rounded: true,
    });
    expect(toPurchaseAmount(1, "marék", BUTTER)).toEqual({
      amount: 250,
      unit: "g",
      rounded: true,
    });
    expect(toPurchaseAmount(3, "", KILO)).toEqual({
      amount: 1,
      unit: "kg",
      rounded: true,
    });
  });

  it("normalizes unit aliases on both sides", () => {
    expect(toPurchaseAmount(500, "gramm", { unit: "KG", amount: 1 })).toEqual({
      amount: 1,
      unit: "kg",
      rounded: true,
    });
  });

  it("handles fractional package sizes", () => {
    // 1.5 l soft drink bottles: 2 l needs two of them.
    expect(toPurchaseAmount(2, "l", { unit: "l", amount: 1.5 })).toEqual({
      amount: 3,
      unit: "l",
      rounded: true,
    });
  });

  it("leaves the amount alone when there is no usable package data", () => {
    expect(toPurchaseAmount(2, "tk", null)).toEqual({
      amount: 2,
      unit: "tk",
      rounded: false,
    });
    expect(toPurchaseAmount(2, "tk", { unit: "kg" })).toEqual({
      amount: 2,
      unit: "tk",
      rounded: false,
    });
    expect(toPurchaseAmount(2, "tk", { unit: "", amount: 1 })).toEqual({
      amount: 2,
      unit: "tk",
      rounded: false,
    });
    expect(toPurchaseAmount(2, "tk", { unit: "kg", amount: 0 })).toEqual({
      amount: 2,
      unit: "tk",
      rounded: false,
    });
  });

  it("leaves non-positive and non-numeric amounts alone", () => {
    expect(toPurchaseAmount(0, "g", KILO)).toEqual({
      amount: 0,
      unit: "g",
      rounded: false,
    });
    expect(toPurchaseAmount(-5, "g", KILO)).toEqual({
      amount: -5,
      unit: "g",
      rounded: false,
    });
    expect(toPurchaseAmount("abc", "g", KILO)).toEqual({
      amount: "abc",
      unit: "g",
      rounded: false,
    });
  });

  it("refuses to round an implausible number of packages", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(toPurchaseAmount(25, "kg", KILO)).toEqual({
      amount: 25,
      unit: "kg",
      rounded: false,
    });
    expect(warn).toHaveBeenCalledOnce();

    // 20 packages is still within the limit.
    expect(toPurchaseAmount(20, "kg", KILO)).toEqual({
      amount: 20,
      unit: "kg",
      rounded: false,
    });
  });
});
