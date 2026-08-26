import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  CATEGORY_COLOR_KEYS,
  categoryAccent,
} from "./categoryColors.js";

// The category names are owned by the backend seed, not by the frontend. Reading
// them from there is the point of this file: a category added to the seed must
// fail here rather than silently render grey in the UI.
const { RAW_CATALOG_ROWS } = await import(
  "../../../backend/scripts/pantrySeedData.js"
);

// Mirrors normalizeCategory() in backend/scripts/seedPantry.js.
const normalizeCategory = (value) =>
  (value || "").toString().trim().replace(/^\d+\.\s*/, "").trim();

const seedCategories = [
  ...new Set(RAW_CATALOG_ROWS.map((row) => normalizeCategory(row.category))),
];

describe("categoryColors covers the seed", () => {
  it("finds categories in the seed data at all (guards the import)", () => {
    expect(seedCategories.length).toBeGreaterThan(5);
  });

  it("has an explicit colour for every seeded category", () => {
    const missing = seedCategories.filter(
      (category) => !CATEGORY_COLOR_KEYS.includes(category),
    );
    expect(missing).toEqual([]);
  });

  it("does not map categories that no longer exist in the seed", () => {
    // "Egyéb" is the frontend's UNKNOWN_CATEGORY, not a seeded one.
    const stale = CATEGORY_COLOR_KEYS.filter(
      (category) => category !== "Egyéb" && !seedCategories.includes(category),
    );
    expect(stale).toEqual([]);
  });

  it("gives each category a distinct colour", () => {
    const values = CATEGORY_COLOR_KEYS.map(categoryAccent);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("categoryAccent", () => {
  it("returns the mapped token for a known category", () => {
    expect(categoryAccent("Zöldségek")).toBe("var(--cat-vegetables)");
  });

  it("strips no prefix itself -- keys are already normalized", () => {
    // "1. Zöldségek" is the raw seed spelling; normalization happens in the seed.
    expect(categoryAccent("1. Zöldségek")).toBe("var(--cat-other)");
  });

  it("falls back to the neutral accent for unknown or empty input", () => {
    expect(categoryAccent("Nincs ilyen kategória")).toBe("var(--cat-other)");
    expect(categoryAccent("")).toBe("var(--cat-other)");
    expect(categoryAccent(undefined)).toBe("var(--cat-other)");
  });
});

describe("index.css defines every token the mapping references", () => {
  it("has a :root declaration for each --cat-* token in use", () => {
    const cssPath = fileURLToPath(new URL("../index.css", import.meta.url));
    const css = readFileSync(cssPath, "utf8");

    const referenced = CATEGORY_COLOR_KEYS.map(categoryAccent).map((value) =>
      value.replace(/^var\(/, "").replace(/\)$/, ""),
    );
    const undefinedTokens = referenced.filter(
      (token) => !css.includes(`${token}:`),
    );
    expect(undefinedTokens).toEqual([]);
  });
});
