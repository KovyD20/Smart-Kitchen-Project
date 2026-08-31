import { describe, expect, it } from "vitest";
import { normalizeCatalogText } from "../constants/pantryCatalog.js";
import {
  availabilityLevel,
  FAVORITES_FILTER,
  cleanIngredient,
  filterRecipes,
  groupIngredients,
  recipeAvailability,
  recipeTimeLabel,
  sortByAvailability,
  sortByCourse,
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

describe("filterRecipes", () => {
  const all = [
    { name: "Gulyásleves", tags: ["magyar", "leves"], favorite: true,
      ingredients: [{ name: "marha" }] },
    { name: "Almás pite", tags: ["desszert"],
      ingredients: [{ name: "alma" }] },
    { name: "Túrós csusza", tags: ["magyar"], favorite: false,
      ingredients: [{ name: "túró" }] },
  ];
  const names = (recipes) => recipes.map((r) => r.name);

  it("returns everything for the default filter", () => {
    expect(names(filterRecipes(all))).toEqual([
      "Gulyásleves",
      "Almás pite",
      "Túrós csusza",
    ]);
  });

  it("filters by tag", () => {
    expect(names(filterRecipes(all, { filterTag: "magyar" }))).toEqual([
      "Gulyásleves",
      "Túrós csusza",
    ]);
  });

  it("filters by the favourite flag, not by a tag lookup", () => {
    expect(names(filterRecipes(all, { filterTag: FAVORITES_FILTER }))).toEqual([
      "Gulyásleves",
    ]);
  });

  it("treats a missing favorite field as not a favourite", () => {
    // Recipes written before the flag existed have no `favorite` at all.
    const legacy = [{ name: "Régi", ingredients: [] }];
    expect(filterRecipes(legacy, { filterTag: FAVORITES_FILTER })).toEqual([]);
  });

  it("matches the search accent-insensitively", () => {
    expect(names(filterRecipes(all, { search: "turos" }))).toEqual([
      "Túrós csusza",
    ]);
  });

  it("searches ingredient names too", () => {
    expect(names(filterRecipes(all, { search: "marha" }))).toEqual([
      "Gulyásleves",
    ]);
  });

  it("applies the chip filter and the search together", () => {
    // "magyar" matches two recipes; the search narrows it to one.
    expect(
      names(filterRecipes(all, { filterTag: "magyar", search: "csusza" })),
    ).toEqual(["Túrós csusza"]);

    // Favourite AND a search that only the non-favourite matches -> nothing.
    expect(
      filterRecipes(all, { filterTag: FAVORITES_FILTER, search: "csusza" }),
    ).toEqual([]);
  });

  it("returns an empty list for an unknown tag", () => {
    expect(filterRecipes(all, { filterTag: "nincs-ilyen" })).toEqual([]);
  });

  it("tolerates a missing list and recipes without tags", () => {
    expect(filterRecipes(undefined)).toEqual([]);
    expect(filterRecipes([{ name: "Címkétlen" }], { filterTag: "magyar" })).toEqual(
      [],
    );
  });

  it("does not mutate the input array", () => {
    const before = names(all);
    filterRecipes(all, { filterTag: "magyar" });
    expect(names(all)).toEqual(before);
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

describe("groupIngredients", () => {
  const ing = (name, group) => ({ name, ...(group ? { group } : {}) });

  it("keeps an ungrouped list as a single unnamed block", () => {
    const blocks = groupIngredients([ing("liszt"), ing("tojás")]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].group).toBeNull();
    expect(blocks[0].items.map((i) => i.name)).toEqual(["liszt", "tojás"]);
  });

  it("splits consecutive runs into one block per group", () => {
    const blocks = groupIngredients([
      ing("gomba", "A töltelékhez"),
      ing("hagyma", "A töltelékhez"),
      ing("liszt", "A tésztához"),
    ]);

    expect(blocks.map((b) => b.group)).toEqual(["A töltelékhez", "A tésztához"]);
    expect(blocks[0].items).toHaveLength(2);
    expect(blocks[1].items).toHaveLength(1);
  });

  it("does not reorder: the same group twice, apart, stays two blocks", () => {
    const blocks = groupIngredients([
      ing("gomba", "A töltelékhez"),
      ing("liszt", "A tésztához"),
      ing("hagyma", "A töltelékhez"),
    ]);

    expect(blocks.map((b) => b.group)).toEqual([
      "A töltelékhez",
      "A tésztához",
      "A töltelékhez",
    ]);
  });

  it("treats a blank group as no group at all", () => {
    const blocks = groupIngredients([ing("liszt"), { name: "só", group: "  " }]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].group).toBeNull();
  });

  it("survives a missing list", () => {
    expect(groupIngredients(undefined)).toEqual([]);
  });
});

describe("cleanIngredient", () => {
  it("drops blank group and note instead of storing empty strings", () => {
    expect(
      cleanIngredient({ name: "liszt", amount: 500, unit: "g", group: "", note: "  " }),
    ).toEqual({ name: "liszt", amount: 500, unit: "g" });
  });

  it("trims the values it keeps", () => {
    expect(
      cleanIngredient({ name: "citrom", group: " A tésztához ", note: " reszelve " }),
    ).toEqual({ name: "citrom", group: "A tésztához", note: "reszelve" });
  });
});

describe("sortByCourse", () => {
  const named = (name, course) => ({ name, tags: course ? [course] : [] });

  it("orders by the fixed course order, not alphabetically", () => {
    const sorted = sortByCourse([
      named("Almás pite", "Desszert"),
      named("Bableves", "Leves"),
      named("Bundás kenyér", "Reggeli"),
    ]);

    expect(sorted.map((r) => r.name)).toEqual([
      "Bundás kenyér",
      "Bableves",
      "Almás pite",
    ]);
  });

  it("sorts by name inside one course", () => {
    const sorted = sortByCourse([
      named("Zöldbableves", "Leves"),
      named("Gulyás", "Leves"),
      named("Áfonyaleves", "Leves"),
    ]);

    expect(sorted.map((r) => r.name)).toEqual([
      "Áfonyaleves",
      "Gulyás",
      "Zöldbableves",
    ]);
  });

  it("puts recipes with no course last", () => {
    const sorted = sortByCourse([
      named("Régi recept", null),
      named("Rakott krumpli", "Főétel"),
    ]);

    expect(sorted.map((r) => r.name)).toEqual(["Rakott krumpli", "Régi recept"]);
  });

  it("treats a lowercase course tag as that course", () => {
    const sorted = sortByCourse([
      named("Régi recept", null),
      named("Bableves", "leves"),
    ]);

    expect(sorted.map((r) => r.name)).toEqual(["Bableves", "Régi recept"]);
  });

  it("does not mutate the input", () => {
    const input = [named("B", "Desszert"), named("A", "Reggeli")];
    sortByCourse(input);
    expect(input.map((r) => r.name)).toEqual(["B", "A"]);
  });

  it("survives a missing list", () => {
    expect(sortByCourse(undefined)).toEqual([]);
  });
});
