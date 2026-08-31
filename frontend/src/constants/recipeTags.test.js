import { describe, expect, it } from "vitest";
import {
  MAIN_TAGS,
  MAIN_TAG_NAMES,
  USER_TAG_COLOR,
  isMainTag,
  mainTagColor,
  mainTagOf,
  sortTags,
} from "./recipeTags";

describe("isMainTag", () => {
  it("recognises every course", () => {
    for (const name of MAIN_TAG_NAMES) expect(isMainTag(name)).toBe(true);
  });

  it("ignores case and surrounding space, so pre-existing tags still match", () => {
    expect(isMainTag("leves")).toBe(true);
    expect(isMainTag("  Desszert ")).toBe(true);
  });

  it("rejects a tag the user invented", () => {
    expect(isMainTag("gyors")).toBe(false);
    expect(isMainTag("")).toBe(false);
    expect(isMainTag(undefined)).toBe(false);
  });
});

describe("mainTagColor", () => {
  it("gives each course its own colour", () => {
    const colors = MAIN_TAGS.map((tag) => tag.color);
    expect(new Set(colors).size).toBe(MAIN_TAGS.length);
    expect(mainTagColor("Leves")).toBe("var(--tag-soup)");
  });

  it("falls back to the neutral colour for the user's own tags", () => {
    expect(mainTagColor("gyors")).toBe(USER_TAG_COLOR);
  });
});

describe("mainTagOf", () => {
  it("finds the course among the user's tags", () => {
    expect(mainTagOf({ tags: ["gyors", "Desszert", "olcsó"] })).toBe("Desszert");
  });

  it("returns null for a recipe saved before courses existed", () => {
    expect(mainTagOf({ tags: ["gyors"] })).toBeNull();
    expect(mainTagOf({})).toBeNull();
    expect(mainTagOf(null)).toBeNull();
  });
});

describe("sortTags", () => {
  it("puts the courses first, in meal order", () => {
    expect(sortTags(["Desszert", "Leves", "Reggeli"])).toEqual([
      "Reggeli",
      "Leves",
      "Desszert",
    ]);
  });

  it("keeps the user's own tags after them, alphabetically", () => {
    expect(sortTags(["zeller", "gyors", "Főétel"])).toEqual([
      "Főétel",
      "gyors",
      "zeller",
    ]);
  });

  it("sorts Hungarian accents naturally", () => {
    expect(sortTags(["ünnepi", "alap", "édes"])).toEqual([
      "alap",
      "édes",
      "ünnepi",
    ]);
  });

  it("does not mutate its input", () => {
    const tags = ["zeller", "Leves"];
    sortTags(tags);
    expect(tags).toEqual(["zeller", "Leves"]);
  });
});
