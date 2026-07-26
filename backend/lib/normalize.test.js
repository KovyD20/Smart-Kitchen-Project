import { describe, it, expect } from "vitest";
import { normalizeCatalogText } from "./normalize.js";

describe("normalizeCatalogText", () => {
  it("strips accents and lowercases", () => {
    expect(normalizeCatalogText("Vöröshagyma")).toBe("voroshagyma");
    expect(normalizeCatalogText("Sárgarépa")).toBe("sargarepa");
    expect(normalizeCatalogText("TEJFÖL")).toBe("tejfol");
  });

  it("turns parentheses, slashes and punctuation into spaces and collapses them", () => {
    expect(normalizeCatalogText("saláta (jégsaláta / fejes)")).toBe(
      "salata jegsalata fejes",
    );
    expect(normalizeCatalogText("vaj / margarin")).toBe("vaj margarin");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeCatalogText("  tojás  ")).toBe("tojas");
  });

  it("returns an empty string for empty / nullish input", () => {
    expect(normalizeCatalogText("")).toBe("");
    expect(normalizeCatalogText("   ")).toBe("");
    expect(normalizeCatalogText(null)).toBe("");
    expect(normalizeCatalogText(undefined)).toBe("");
  });
});
