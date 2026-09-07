import { describe, it, expect } from "vitest";
import {
  extractRecipe,
  recipeToText,
  parseIsoDuration,
  parseYield,
  parseJsonLdBlocks,
} from "./recipeJsonLd.js";

// The shapes here are the ones real Hungarian recipe sites emit (nosalty and
// mindmegette were read directly while writing this), not invented schema.org
// examples: @graph wrappers, HowToStep objects, markup inside fields, and a page
// title leaking into `name` are all things that actually happen.
function page(...blocks) {
  const scripts = blocks
    .map((block) => {
      const json = typeof block === "string" ? block : JSON.stringify(block);
      return `<script type="application/ld+json">${json}</script>`;
    })
    .join("\n");
  return `<html><head>${scripts}</head><body><p>oldal zaj</p></body></html>`;
}

const RECIPE = {
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "Gulyásleves",
  recipeYield: "6 adag",
  totalTime: "PT1H30M",
  recipeIngredient: ["50 dkg marhalábszár", "2 fej vöröshagyma"],
  recipeInstructions: [
    { "@type": "HowToStep", text: "<p>Pirítsd meg a hagymát.</p>" },
    { "@type": "HowToStep", text: "Add hozzá a húst." },
  ],
};

describe("parseIsoDuration", () => {
  it("reads the common forms", () => {
    expect(parseIsoDuration("PT1H30M")).toBe(90);
    expect(parseIsoDuration("PT45M")).toBe(45);
    expect(parseIsoDuration("PT2H")).toBe(120);
    expect(parseIsoDuration("P1DT2H")).toBe(1560);
  });

  it("returns null for nothing usable", () => {
    for (const value of ["", "holnap", null, undefined, "PT0M", {}]) {
      expect(parseIsoDuration(value), String(value)).toBeNull();
    }
  });

  // A leading M is months. No recipe takes months, and reading it as minutes
  // would turn "P2M" into a 2-minute stew.
  it("does not read a month as a minute", () => {
    expect(parseIsoDuration("P2M")).toBeNull();
  });
});

describe("parseYield", () => {
  it("pulls the number out of whatever form the site used", () => {
    expect(parseYield(4)).toBe(4);
    expect(parseYield("4")).toBe(4);
    expect(parseYield("6 adag")).toBe(6);
    expect(parseYield("4 servings")).toBe(4);
    expect(parseYield(["8 adag", "8"])).toBe(8);
    expect(parseYield({ "@type": "QuantitativeValue", value: 12 })).toBe(12);
  });

  it("returns null when there is no number", () => {
    for (const value of [null, undefined, "", "több adag", {}]) {
      expect(parseYield(value), String(value)).toBeNull();
    }
  });
});

describe("parseJsonLdBlocks", () => {
  it("reads every block on the page", () => {
    const blocks = parseJsonLdBlocks(page({ "@type": "Organization" }, RECIPE));
    expect(blocks).toHaveLength(2);
  });

  // A broken analytics or breadcrumb block must not cost us the recipe.
  it("skips a malformed block and keeps the rest", () => {
    const blocks = parseJsonLdBlocks(page("{ nem json", RECIPE));
    expect(blocks).toHaveLength(1);
    expect(blocks[0].name).toBe("Gulyásleves");
  });

  it("handles a CDATA-wrapped block", () => {
    const html = `<html><head><script type="application/ld+json">//<![CDATA[
      ${JSON.stringify(RECIPE)}
    ]]></script></head><body></body></html>`;
    // The CDATA opener is preceded by a JS comment on some sites, which is not
    // valid JSON -- if that ever needs supporting, this test says so plainly.
    expect(parseJsonLdBlocks(html)).toHaveLength(0);
  });

  it("returns an empty list for a page with no JSON-LD", () => {
    expect(parseJsonLdBlocks("<html><body>semmi</body></html>")).toEqual([]);
  });
});

describe("extractRecipe", () => {
  it("extracts a plain Recipe block", () => {
    expect(extractRecipe(page(RECIPE))).toEqual({
      name: "Gulyásleves",
      servings: 6,
      timeMinutes: 90,
      ingredients: ["50 dkg marhalábszár", "2 fej vöröshagyma"],
      steps: ["Pirítsd meg a hagymát.", "Add hozzá a húst."],
    });
  });

  it("finds a Recipe nested in an @graph", () => {
    const html = page({
      "@context": "https://schema.org",
      "@graph": [{ "@type": "WebPage" }, { "@type": "BreadcrumbList" }, RECIPE],
    });
    expect(extractRecipe(html).name).toBe("Gulyásleves");
  });

  it("accepts @type given as an array", () => {
    const html = page({ ...RECIPE, "@type": ["Recipe", "NewsArticle"] });
    expect(extractRecipe(html).name).toBe("Gulyásleves");
  });

  it("skips non-recipe blocks to find the recipe", () => {
    const html = page({ "@type": "Organization", name: "Nem ez" }, RECIPE);
    expect(extractRecipe(html).name).toBe("Gulyásleves");
  });

  // Observed on mindmegette.hu: the page title, site suffix included, is used
  // as the recipe name.
  it("strips a site suffix from the name", () => {
    const html = page({ ...RECIPE, name: "Klasszikus gulyásleves | Mindmegette.hu" });
    expect(extractRecipe(html).name).toBe("Klasszikus gulyásleves");
  });

  it("adds up prepTime and cookTime when there is no totalTime", () => {
    const { totalTime, ...rest } = RECIPE;
    const html = page({ ...rest, prepTime: "PT20M", cookTime: "PT40M" });
    expect(extractRecipe(html).timeMinutes).toBe(60);
  });

  it("handles instructions given as HowToSections", () => {
    const html = page({
      ...RECIPE,
      recipeInstructions: [
        {
          "@type": "HowToSection",
          name: "Előkészítés",
          itemListElement: [{ "@type": "HowToStep", text: "Vágd fel a hagymát." }],
        },
        {
          "@type": "HowToSection",
          itemListElement: [{ "@type": "HowToStep", text: "Főzd meg." }],
        },
      ],
    });
    expect(extractRecipe(html).steps).toEqual(["Vágd fel a hagymát.", "Főzd meg."]);
  });

  it("handles instructions given as one marked-up string", () => {
    const html = page({
      ...RECIPE,
      recipeInstructions: "<p>Pirítsd meg a hagymát.</p><p>Add hozzá a húst.</p>",
    });
    // One <p> per step is the usual intent, and htmlToText already turns those
    // into separate lines.
    expect(extractRecipe(html).steps).toEqual([
      "Pirítsd meg a hagymát.",
      "Add hozzá a húst.",
    ]);
  });

  it("accepts the legacy `ingredients` key", () => {
    const { recipeIngredient, ...rest } = RECIPE;
    const html = page({ ...rest, ingredients: ["1 kg burgonya"] });
    expect(extractRecipe(html).ingredients).toEqual(["1 kg burgonya"]);
  });

  it("returns null when the page has no JSON-LD at all", () => {
    expect(extractRecipe("<html><body>sima oldal</body></html>")).toBeNull();
  });

  // A Recipe node with no ingredients is a stub -- a "related recipe" marker on a
  // category page, or a paywalled teaser. The raw page text is the better input.
  it("returns null for a Recipe with no ingredients", () => {
    const { recipeIngredient, ...rest } = RECIPE;
    expect(extractRecipe(page(rest))).toBeNull();
  });

  it("survives a missing name, yield and time", () => {
    const html = page({
      "@type": "Recipe",
      recipeIngredient: ["2 tojás"],
    });
    expect(extractRecipe(html)).toEqual({
      name: null,
      servings: null,
      timeMinutes: null,
      ingredients: ["2 tojás"],
      steps: [],
    });
  });
});

describe("recipeToText", () => {
  it("renders the labelled block the prompt reads", () => {
    expect(recipeToText(extractRecipe(page(RECIPE)))).toBe(
      [
        "Étel neve: Gulyásleves",
        "Adagok száma: 6",
        "Elkészítési idő: 90 perc",
        "",
        "Hozzávalók:",
        "- 50 dkg marhalábszár",
        "- 2 fej vöröshagyma",
        "",
        "Elkészítés:",
        "1. Pirítsd meg a hagymát.",
        "2. Add hozzá a húst.",
      ].join("\n"),
    );
  });

  it("omits the fields the page did not provide", () => {
    const text = recipeToText({
      name: null,
      servings: null,
      timeMinutes: null,
      ingredients: ["2 tojás"],
      steps: [],
    });
    expect(text).toBe(["", "Hozzávalók:", "- 2 tojás"].join("\n"));
  });

  // The whole point of this path: a 300kB page of navigation and ads becomes
  // about a kilobyte of actual recipe.
  it("is far shorter than the page it came from", () => {
    const html = page(RECIPE) + "<div>".repeat(5000);
    expect(recipeToText(extractRecipe(html)).length).toBeLessThan(html.length / 10);
  });
});
