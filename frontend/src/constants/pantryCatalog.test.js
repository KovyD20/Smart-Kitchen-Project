import { describe, it, expect } from "vitest";
import { normalizeCatalogText, createCatalog } from "./pantryCatalog.js";

// Small hand-built catalog in the shape returned by GET /api/pantry/catalog.
const catalogData = {
  categories: [
    {
      name: "Zöldségek",
      sortOrder: 0,
      items: [
        {
          id: 1,
          canonicalName: "vöröshagyma",
          normalizedKey: "voroshagyma",
          priority: "essential",
          purchase: { unit: "kg", amount: 1 },
          aliases: ["voros hagyma", "piros hagyma"],
        },
        {
          id: 2,
          canonicalName: "burgonya",
          normalizedKey: "burgonya",
          priority: "good_to_have",
          // Half-filled package data is unusable and must not reach the UI.
          purchase: { unit: "kg" },
          aliases: ["krumpli"],
        },
      ],
    },
    {
      name: "Tejtermékek",
      sortOrder: 1,
      items: [
        {
          id: 3,
          canonicalName: "tej",
          normalizedKey: "tej",
          priority: "essential",
          aliases: [],
        },
      ],
    },
  ],
};

describe("normalizeCatalogText (frontend copy — must match backend lib/normalize)", () => {
  it("strips accents, lowercases, and cleans punctuation", () => {
    expect(normalizeCatalogText("Vöröshagyma")).toBe("voroshagyma");
    expect(normalizeCatalogText("saláta (jégsaláta / fejes)")).toBe(
      "salata jegsalata fejes",
    );
    expect(normalizeCatalogText("")).toBe("");
  });
});

describe("createCatalog", () => {
  const catalog = createCatalog(catalogData);

  it("resolves aliases to the canonical key", () => {
    expect(catalog.resolveCatalogKey("krumpli")).toBe("burgonya");
    expect(catalog.resolveCatalogKey("Vöröshagyma")).toBe("voroshagyma");
  });

  it("resolves the canonical display name, keeping accents for unknown items", () => {
    expect(catalog.resolveCanonicalCatalogName("krumpli")).toBe("burgonya");
    expect(catalog.resolveCanonicalCatalogName("Almás pite")).toBe("Almás pite");
  });

  it("groups items by category in sort order, unknown items under 'Egyéb'", () => {
    const grouped = catalog.groupItemsByCatalog([
      { name: "krumpli", amount: 2, unit: "kg" },
      { name: "tej" },
      { name: "valami ismeretlen" },
    ]);

    expect(grouped.map((g) => g.category)).toEqual([
      "Zöldségek",
      "Tejtermékek",
      "Egyéb",
    ]);
    expect(grouped[0].items[0].displayName).toBe("burgonya");
    expect(grouped[2].items[0].displayName).toBe("valami ismeretlen");
  });

  it("recommends missing items split by priority", () => {
    const { essential, goodToHave, extra } =
      catalog.getMissingCatalogRecommendations([{ name: "tej" }], []);

    expect(essential.map((i) => i.name)).toEqual(["vöröshagyma"]);
    expect(goodToHave.map((i) => i.name)).toEqual(["burgonya"]);
    expect(extra).toEqual([]);
  });
});

describe("createCatalog package data", () => {
  const catalog = createCatalog(catalogData);

  it("exposes a usable package size on the catalog entry", () => {
    expect(catalog.getCatalogItemByName("voros hagyma").purchase).toEqual({
      unit: "kg",
      amount: 1,
    });
  });

  it("drops half-filled package data, and reports none as null", () => {
    expect(catalog.getCatalogItemByName("krumpli").purchase).toBeNull();
    expect(catalog.getCatalogItemByName("tej").purchase).toBeNull();
  });

  it("carries the package size onto grouped items", () => {
    const groups = catalog.groupItemsByCatalog([
      { id: "1", name: "krumpli", amount: 2, unit: "kg" },
      { id: "2", name: "vöröshagyma", amount: 1, unit: "kg" },
    ]);
    const items = groups.flatMap((group) => group.items);

    expect(items.find((i) => i.id === "2").purchase).toEqual({
      unit: "kg",
      amount: 1,
    });
    expect(items.find((i) => i.id === "1").purchase).toBeNull();
  });
});
