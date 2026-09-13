import { describe, it, expect } from "vitest";
import {
  SUGGESTION_LIMIT,
  buildSuggestionIndex,
  searchSuggestions,
} from "./catalogSearch.js";

// Entries in the shape createCatalog builds them, keys already folded the way
// normalizeCatalogText folds them.
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
  entry("kelkaposzta", "kelkáposzta", "Zöldségek"),
  entry("kave", "kávé", "Szárazáru"),
  entry("burgonya", "burgonya", "Zöldségek", "good_to_have"),
  entry("tej", "tej", "Tejtermékek", "essential"),
  entry("tejfol", "tejföl", "Tejtermékek", "good_to_have"),
];

const byKey = Object.fromEntries(ENTRIES.map((item) => [item.key, item]));

const ALIASES = new Map([
  ["krumpli", byKey.burgonya],
  ["kerek kenyer", byKey.kenyer],
]);

const index = buildSuggestionIndex(ENTRIES, ALIASES);
const search = (query, limit) =>
  searchSuggestions(index, query, limit).map((match) => match.entry.name);

describe("searchSuggestions", () => {
  it("offers every item whose name starts with the typed text", () => {
    const names = search("ke");
    expect(names).toContain("kenyér");
    expect(names).toContain("kefir");
    expect(names).toContain("kelkáposzta");
  });

  it("also matches at the start of a later word", () => {
    // The point of the feature: "natúr kefir" has to be reachable by typing the
    // part of the name that identifies the product.
    expect(search("ke")).toContain("natúr kefir");
  });

  it("does not match inside a word", () => {
    // "fir" sits in kefir, but not at any word boundary.
    expect(search("fir")).toEqual([]);
  });

  it("ignores accents in the query, so a phone keyboard is enough", () => {
    expect(search("kave")).toEqual(["kávé"]);
    expect(search("ká")).toEqual(["kávé"]);
  });

  it("ranks a name match above a match in a later word", () => {
    const names = search("ke");
    expect(names.indexOf("kefir")).toBeLessThan(names.indexOf("natúr kefir"));
  });

  it("ranks an alias match last and reports which alias matched", () => {
    const matches = searchSuggestions(index, "kr");
    expect(matches).toHaveLength(1);
    expect(matches[0].entry.name).toBe("burgonya");
    expect(matches[0].alias).toBe("krumpli");
  });

  it("returns an item once even when its name and an alias both match", () => {
    const matches = searchSuggestions(index, "ke");
    const kenyer = matches.filter((match) => match.entry.name === "kenyér");
    expect(kenyer).toHaveLength(1);
    // The better of the two matches wins, so the row is not labelled with the
    // alias it did not need.
    expect(kenyer[0].alias).toBeNull();
  });

  it("breaks a tie on catalog priority", () => {
    // Both start with "ke"; kenyér is a staple and kelkáposzta is not.
    const names = search("ke");
    expect(names.indexOf("kenyér")).toBeLessThan(names.indexOf("kelkáposzta"));
  });

  it("puts the shorter, more general name first at equal priority", () => {
    expect(search("tej")).toEqual(["tej", "tejföl"]);
  });

  it("matches a multi-word query as typed", () => {
    expect(search("natur ke")).toEqual(["natúr kefir"]);
  });

  it("returns nothing for an empty or punctuation-only query", () => {
    expect(search("")).toEqual([]);
    expect(search("   ")).toEqual([]);
    expect(search("(")).toEqual([]);
  });

  it("caps the list, by default at SUGGESTION_LIMIT", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      entry(`teszt ${i}`, `teszt ${i}`, "Egyéb"),
    );
    const bigIndex = buildSuggestionIndex(many, new Map());

    expect(searchSuggestions(bigIndex, "teszt")).toHaveLength(SUGGESTION_LIMIT);
    expect(searchSuggestions(bigIndex, "teszt", 3)).toHaveLength(3);
  });

  it("survives an empty catalog", () => {
    expect(searchSuggestions(buildSuggestionIndex([], new Map()), "ke")).toEqual(
      [],
    );
  });
});
