import { describe, it, expect } from "vitest";
import {
  normalizeUnit,
  unitInfo,
  areUnitsCompatible,
  convertAmount,
  stripAmountsAndUnits,
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
