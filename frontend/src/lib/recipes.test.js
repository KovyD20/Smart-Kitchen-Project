import { describe, expect, it } from "vitest";
import { normalizeCatalogText } from "../constants/pantryCatalog.js";
import {
  availabilityLevel,
  recipeAvailability,
  recipeTimeLabel,
  sortByAvailability,
} from "./recipes.js";

// The real catalog resolves aliases too, but accent/case folding is what the
// availability count depends on, and that is what normalizeCatalogText provides.
const keyOf = (name) => normalizeCatalogText(name);

const recipe = (name, ingredientNames, extra = {}) => ({
  name,
  ingredients: ingredientNames.map((n) => ({ name: n })),
  ...extra,
});

const fridgeOf = (...names) => names.map((name) => ({ name }));

describe("recipeAvailability", () => {
  it("counts how many ingredients are in the fridge", () => {
    const result = recipeAvailability(
      recipe("Rakott krumpli", ["burgonya", "tojás", "tejföl", "kolbász"]),
      fridgeOf("burgonya", "tojás"),
      keyOf,
    );
    expect(result).toEqual({ have: 2, total: 4, ratio: 0.5 });
  });

  it("matches across accents and casing", () => {
    const result = recipeAvailability(
      recipe("Túrós csusza", ["Túró", "Tejföl"]),
      fridgeOf("turo", "TEJFOL"),
      keyOf,
    );
    expect(result).toEqual({ have: 2, total: 2, ratio: 1 });
  });

  it("reports an empty fridge as nothing available", () => {
    const result = recipeAvailability(recipe("Gulyás", ["marha"]), [], keyOf);
    expect(result).toEqual({ have: 0, total: 1, ratio: 0 });
  });

  it("returns a zero ratio for a recipe with no ingredients", () => {
    // Guards the division: total 0 must not produce NaN, which would poison the sort.
    expect(recipeAvailability(recipe("Üres", []), fridgeOf("víz"), keyOf)).toEqual({
      have: 0,
      total: 0,
      ratio: 0,
    });
    expect(recipeAvailability(null, fridgeOf("víz"), keyOf).ratio).toBe(0);
  });
});

describe("availabilityLevel", () => {
  it("labels a fully stocked recipe as full", () => {
    expect(availabilityLevel({ have: 3, total: 3 })).toBe("full");
  });

  it("labels a partially stocked recipe as partial", () => {
    expect(availabilityLevel({ have: 1, total: 3 })).toBe("partial");
  });

  it("labels nothing-available and no-ingredients as empty", () => {
    expect(availabilityLevel({ have: 0, total: 3 })).toBe("empty");
    expect(availabilityLevel({ have: 0, total: 0 })).toBe("empty");
    expect(availabilityLevel(undefined)).toBe("empty");
  });
});

describe("sortByAvailability", () => {
  it("puts the higher ratio first, not the higher raw count", () => {
    // 3/3 beats 6/20 even though 6 > 3 -- the small recipe is cookable now.
    const small = recipe("Bundás kenyér", ["kenyér", "tojás", "olaj"]);
    const big = recipe("Nagy fogás", [
      ...["kenyér", "tojás", "olaj", "só", "bors", "vaj"],
      ...Array.from({ length: 14 }, (_, i) => `ismeretlen-${i}`),
    ]);
    const fridge = fridgeOf("kenyér", "tojás", "olaj", "só", "bors", "vaj");

    const sorted = sortByAvailability([big, small], fridge, keyOf);
    expect(sorted.map((r) => r.name)).toEqual(["Bundás kenyér", "Nagy fogás"]);
  });

  it("breaks an equal ratio on fewer missing ingredients", () => {
    // Both are at 1/2, but the tie-break prefers the one needing less shopping.
    const two = recipe("Kettő", ["alma", "banán"]);
    const four = recipe("Négy", ["alma", "banán", "citrom", "dinnye"]);
    const fridge = fridgeOf("alma", "citrom");

    // two -> 1/2 = 0.5, four -> 2/4 = 0.5; two misses 1, four misses 2.
    const sorted = sortByAvailability([four, two], fridge, keyOf);
    expect(sorted.map((r) => r.name)).toEqual(["Kettő", "Négy"]);
  });

  it("breaks a full tie on Hungarian collation", () => {
    const sorted = sortByAvailability(
      [recipe("Zsemle", ["x"]), recipe("Árpa", ["x"]), recipe("Ostya", ["x"])],
      [],
      keyOf,
    );
    expect(sorted.map((r) => r.name)).toEqual(["Árpa", "Ostya", "Zsemle"]);
  });

  it("sinks ingredient-less recipes to the bottom", () => {
    const sorted = sortByAvailability(
      [recipe("Üres", []), recipe("Van benne", ["alma"])],
      fridgeOf("alma"),
      keyOf,
    );
    expect(sorted.map((r) => r.name)).toEqual(["Van benne", "Üres"]);
  });

  it("does not mutate the input array", () => {
    const input = [recipe("B", ["x"]), recipe("A", ["x"])];
    const before = input.map((r) => r.name);
    sortByAvailability(input, [], keyOf);
    expect(input.map((r) => r.name)).toEqual(before);
  });

  it("tolerates a missing list", () => {
    expect(sortByAvailability(undefined, [], keyOf)).toEqual([]);
  });
});

describe("recipeTimeLabel", () => {
  it("formats both field spellings", () => {
    expect(recipeTimeLabel({ time: 45 })).toBe("45 perc");
    expect(recipeTimeLabel({ time_minutes: 90 })).toBe("90 perc");
  });

  it("returns null when there is no usable time", () => {
    expect(recipeTimeLabel({})).toBeNull();
    expect(recipeTimeLabel({ time: 0 })).toBeNull();
    expect(recipeTimeLabel(null)).toBeNull();
  });
});
