import { describe, it, expect } from "vitest";
import { normalizeCatalogText } from "./catalogText.js";
import sharedCases from "../../../shared/normalizeCatalogText.cases.json";

describe("normalizeCatalogText (frontend copy — must match backend lib/normalize)", () => {
  it("strips accents, lowercases, and cleans punctuation", () => {
    expect(normalizeCatalogText("Vöröshagyma")).toBe("voroshagyma");
    expect(normalizeCatalogText("saláta (jégsaláta / fejes)")).toBe(
      "salata jegsalata fejes",
    );
    expect(normalizeCatalogText("")).toBe("");
  });
});

// This copy of normalizeCatalogText has to agree with backend/lib/normalize.js
// character for character, or every alias the seed wrote stops matching what the
// browser looks up. Both suites walk the same list — see the file's own `why`.
describe("normalizeCatalogText agrees with the shared cases", () => {
  it.each(sharedCases.cases)("$in -> $out", ({ in: input, out }) => {
    expect(normalizeCatalogText(input)).toBe(out);
  });

  it("returns an empty string for nullish input", () => {
    expect(normalizeCatalogText(null)).toBe("");
    expect(normalizeCatalogText(undefined)).toBe("");
  });
});
