import { describe, it, expect } from "vitest";
import { pantryImageSlug, pantryImageUrl } from "./pantryImages.js";

describe("pantryImageSlug", () => {
  it("turns the spaces normalizeCatalogText leaves behind into dashes", () => {
    expect(pantryImageSlug("csirke mellfile")).toBe("csirke-mellfile");
    expect(pantryImageSlug("salata jegsalata fejes")).toBe(
      "salata-jegsalata-fejes",
    );
  });

  it("leaves single-word keys alone", () => {
    expect(pantryImageSlug("voroshagyma")).toBe("voroshagyma");
  });

  it("returns an empty string for empty input", () => {
    expect(pantryImageSlug("")).toBe("");
    expect(pantryImageSlug(null)).toBe("");
    expect(pantryImageSlug(undefined)).toBe("");
  });
});

describe("pantryImageUrl", () => {
  it("builds the conventional path from the catalog key", () => {
    expect(pantryImageUrl({ nameKey: "tej" })).toBe("/pantry/tej.webp");
    expect(pantryImageUrl({ nameKey: "csirke mellfile" })).toBe(
      "/pantry/csirke-mellfile.webp",
    );
  });

  it("prefers an explicit imageUrl over the convention", () => {
    expect(
      pantryImageUrl({ nameKey: "tej", imageUrl: "https://cdn/x/milk.webp" }),
    ).toBe("https://cdn/x/milk.webp");
  });

  it("returns null when there is nothing to build a path from", () => {
    expect(pantryImageUrl({ nameKey: "" })).toBeNull();
    expect(pantryImageUrl({})).toBeNull();
    expect(pantryImageUrl(null)).toBeNull();
    expect(pantryImageUrl(undefined)).toBeNull();
  });
});
