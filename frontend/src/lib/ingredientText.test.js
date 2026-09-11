import { describe, it, expect } from "vitest";
import {
  IGNORED_INGREDIENTS,
  isIgnoredIngredient,
  ingredientNameCandidates,
  strippedModifiers,
} from "./ingredientText.js";

const cleaned = (name) => ingredientNameCandidates(name).at(-1);

describe("ingredientNameCandidates", () => {
  it("offers the untouched name first", () => {
    // The whole safety of the cleaner rests on this order.
    expect(ingredientNameCandidates("őrölt kávé")[0]).toBe("őrölt kávé");
    expect(ingredientNameCandidates("  paprika  ")[0]).toBe("paprika");
  });

  it("strips the purpose suffix", () => {
    expect(cleaned("porcukor a szóráshoz")).toBe("porcukor");
    expect(cleaned("tojás a kenéshez")).toBe("tojás");
    expect(cleaned("vaj a tepsi kikenéséhez")).toBe("vaj");
    expect(cleaned("liszt a tepsi lisztezéséhez")).toBe("liszt");
    expect(cleaned("petrezselyem a tálalásra")).toBe("petrezselyem");
  });

  it("strips state and preparation words", () => {
    expect(cleaned("őrölt fahéj")).toBe("fahéj");
    expect(cleaned("Szárított oregánó")).toBe("oregánó");
    expect(cleaned("morzsolt oregánó")).toBe("oregánó");
    expect(cleaned("Száraz fehérbor")).toBe("fehérbor");
    expect(cleaned("Reszelt parmezán sajt")).toBe("parmezán sajt");
    expect(cleaned("langyos tej")).toBe("tej");
    expect(cleaned("nagy marha velőscsont")).toBe("marha velőscsont");
    expect(cleaned("csirkemell filé")).toBe("csirkemell");
  });

  it("strips a state word written without accents too", () => {
    expect(cleaned("orolt fahej")).toBe("fahej");
    expect(cleaned("SZARITOTT oregano")).toBe("oregano");
  });

  it("combines the two rules", () => {
    expect(cleaned("olvasztott vaj a kenéshez")).toBe("vaj");
  });

  it("leaves product qualifiers alone", () => {
    // These name a different product. Anything the cleaner does not recognise
    // has to survive untouched — landing in "Egyéb" is the safe outcome.
    for (const name of [
      "vaníliás cukor",
      "porcukor",
      "teljes kiőrlésű liszt",
      "tojássárgája",
      "füstölt szalonna",
      "cukrozatlan kakaópor",
      "bio tej",
      "laktózmentes tejföl",
    ]) {
      expect(ingredientNameCandidates(name), `changed: ${name}`).toEqual([name]);
    }
  });

  it("never returns an empty name", () => {
    // "darált" on its own is all modifier: better to keep it and fail to resolve
    // than to hand the catalog an empty string.
    expect(cleaned("darált")).toBe("darált");
    expect(cleaned("a kenéshez")).toBe("a kenéshez");
    expect(ingredientNameCandidates("")).toEqual([]);
    expect(ingredientNameCandidates(null)).toEqual([]);
  });

  it("does not repeat a candidate that cleaning left unchanged", () => {
    expect(ingredientNameCandidates("paprika")).toEqual(["paprika"]);
  });
});

describe("strippedModifiers", () => {
  it("reports the words the resolver drops, in order", () => {
    expect(strippedModifiers("Reszelt parmezán sajt")).toEqual(["reszelt"]);
    expect(strippedModifiers("olvasztott langyos vaj")).toEqual([
      "olvasztott",
      "langyos",
    ]);
    expect(strippedModifiers("paprika")).toEqual([]);
  });

  it("writes the note in lowercase, whatever the recipe shouted", () => {
    // The word is lifted out of a name, not written as a sentence.
    expect(strippedModifiers("Száraz fehérbor")).toEqual(["száraz"]);
    expect(strippedModifiers("Szárított morzsolt oregánó")).toEqual([
      "szárított",
      "morzsolt",
    ]);
  });

  it("drops a word the row's own name already says", () => {
    expect(strippedModifiers("darált sertés", "darált sertés")).toEqual([]);
    expect(strippedModifiers("szárított tárkony", "szárított tárkony")).toEqual([]);
    // Still a note when the row is named after something else.
    expect(strippedModifiers("Reszelt parmezán sajt", "parmezán")).toEqual([
      "reszelt",
    ]);
  });

  it("keeps the size, because it says which one to pick up", () => {
    expect(strippedModifiers("nagy marha velőscsont", "velőscsont")).toEqual([
      "nagy",
    ]);
  });

  it("ignores the purpose suffix rather than reporting it", () => {
    expect(strippedModifiers("olvasztott vaj a kenéshez")).toEqual(["olvasztott"]);
  });
});

describe("isIgnoredIngredient", () => {
  it("knows what comes out of the tap", () => {
    expect(isIgnoredIngredient("víz")).toBe(true);
    expect(isIgnoredIngredient("Víz")).toBe(true);
    expect(isIgnoredIngredient("viz")).toBe(true);
    expect(isIgnoredIngredient("csapvíz")).toBe(true);
    expect(isIgnoredIngredient("jég")).toBe(true);
  });

  it("does not swallow a real product whose name contains water", () => {
    expect(isIgnoredIngredient("ásványvíz")).toBe(false);
    expect(isIgnoredIngredient("jégkrém")).toBe(false);
    expect(isIgnoredIngredient("rózsavíz")).toBe(false);
    expect(isIgnoredIngredient("")).toBe(false);
  });

  it("holds normalized keys, so callers may pass any spelling", () => {
    expect(IGNORED_INGREDIENTS.has("viz")).toBe(true);
    expect(IGNORED_INGREDIENTS.has("víz")).toBe(false);
  });
});
