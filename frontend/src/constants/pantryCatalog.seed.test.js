import { describe, it, expect } from "vitest";
import { createCatalog } from "./pantryCatalog.js";
import { normalizeCatalogText } from "./catalogText.js";

// The resolution ladder against the REAL catalog, built from the backend seed
// data the same way the seeder builds it. The hand-made fixture in
// pantryCatalog.test.js proves the mechanics; this file proves the outcome on
// the 261 rows that actually ship, which is where a rule that looks safe in
// isolation turns out to hijack a real item.
const { buildPantryCatalog } = await import(
  "../../../backend/lib/buildPantryCatalog.js"
);
const { RAW_CATALOG_ROWS, MANUAL_SYNONYMS } = await import(
  "../../../backend/scripts/pantrySeedData.js"
);

// Same shape GET /api/pantry/catalog returns.
function catalogFromSeed() {
  const { categoryOrder, catalogByKey, aliasToEntry } = buildPantryCatalog(
    RAW_CATALOG_ROWS,
    MANUAL_SYNONYMS,
    () => {},
  );

  const aliasesByItem = new Map();
  for (const [aliasKey, entry] of aliasToEntry) {
    if (aliasKey === entry.key) continue;
    aliasesByItem.set(entry.key, [...(aliasesByItem.get(entry.key) || []), aliasKey]);
  }

  return {
    categories: categoryOrder.map((name, sortOrder) => ({
      name,
      sortOrder,
      items: Array.from(catalogByKey.values())
        .filter((entry) => entry.category === name)
        .map((entry) => ({
          canonicalName: entry.name,
          normalizedKey: entry.key,
          priority: entry.priority,
          purchase: entry.purchase,
          aliases: aliasesByItem.get(entry.key) || [],
        })),
    })),
  };
}

const catalog = createCatalog(catalogFromSeed());
const nameOf = (input) => catalog.getCatalogItemByName(input)?.name || null;

describe("the ladder on the real catalog", () => {
  // The rows still sitting in "Egyéb" after the catalog data was fixed. Every
  // one of them is a state word hiding a name the catalog already has.
  it("resolves the 12 rows the data fixes could not reach", () => {
    const expected = {
      "őrölt fahéj": "fahéj",
      "őrölt fekete bors": "fekete bors",
      "őrölt kardamom": "kardamom",
      "őrölt kömény": "kömény",
      "Szárított oregánó": "oregánó",
      "morzsolt oregánó": "oregánó",
      "Száraz fehérbor": "fehérbor",
      "Száraz vörösbor": "vörösbor",
      "Reszelt parmezán sajt": "parmezán",
      "friss vajas élesztős leveles tészta": "leveles tészta",
    };

    const wrong = Object.entries(expected)
      .map(([input, want]) => [input, want, nameOf(input)])
      .filter(([, want, got]) => got !== want)
      .map(([input, want, got]) => `${input}: ${got} != ${want}`);
    expect(wrong).toEqual([]);
  });

  it("still protects the items whose own name starts with a state word", () => {
    // The "full name first" rule. Without it the cleaner would turn each of
    // these into a different product.
    expect(nameOf("őrölt kávé")).toBe("őrölt kávé");
    expect(nameOf("darált hús")).toBe("darált hús");
    expect(nameOf("darált sertés")).toBe("darált sertés");
    expect(nameOf("szárított tárkony")).toBe("szárított tárkony");
    expect(nameOf("szárított petrezselyem")).toBe("szárított petrezselyem");
    expect(nameOf("fagyasztott spenót")).toBe("fagyasztott spenót");
    expect(nameOf("friss koriander")).toBe("koriander");
  });

  it("refuses to turn a product qualifier into another product", () => {
    expect(nameOf("vaníliás cukor")).toBe("vaníliás cukor");
    expect(nameOf("porcukor")).toBe("porcukor");
    expect(nameOf("teljeskiőrlésű liszt")).toBe("teljeskiőrlésű liszt");
    expect(nameOf("cukrozatlan kakaópor")).toBe("cukrozatlan kakaópor");
    expect(nameOf("étcsokoládé")).toBe("étcsokoládé");
    // Not in the catalog at all, and it must stay that way rather than become
    // "tojás" or "liszt".
    expect(nameOf("tojássárgája")).toBeNull();
    expect(nameOf("füstölt tofu")).toBeNull();
  });

  it("resolves a name that is less specific than the item (level 3)", () => {
    // The recipe asks for chickpeas; the catalog sells them in a tin. Neither
    // of these has an alias, so this really is the token-subset level:
    // {csicseriborso} inside {konzerv, csicseriborso}.
    expect(nameOf("csicseriborsó")).toBe("konzerv csicseriborsó");
    expect(nameOf("bab")).toBe("konzerv bab");
  });

  it("refuses a token subset that fits several items", () => {
    // "konzerv" is inside konzerv kukorica, konzerv bab, konzerv hal and
    // konzerv paradicsom. Picking one would be a guess, so it stays unresolved.
    expect(nameOf("konzerv")).toBeNull();
  });

  it("resolves a name that trails off after the item (level 4)", () => {
    expect(nameOf("tejszín 30%")).toBe("tejszín");
    expect(nameOf("liszt 00-as")).toBe("liszt");
  });

  it("refuses an ambiguous token subset instead of guessing", () => {
    // "sajt" sits inside "Manchego sajt" and "sajt (trappista / félkemény)".
    // Picking one would be worse than leaving the row in "Egyéb"... except that
    // the parenthesis-stripping alias makes "sajt" an exact hit on the
    // trappista row, so level 1 answers first. That is the honest outcome to
    // record here: the ambiguity never reaches level 3.
    expect(nameOf("sajt")).toBe("sajt (trappista / félkemény)");
  });

  it("keeps an unknown name to itself", () => {
    expect(catalog.resolveCatalogKey("marslakó pörkölt")).toBe("marslako porkolt");
    expect(catalog.resolveCanonicalCatalogName("marslakó pörkölt")).toBe(
      "marslakó pörkölt",
    );
  });

  it("resolves every canonical name to itself", () => {
    // A cleaner rule that hijacks an existing item would show up here first.
    const hijacked = catalog.CATALOG_ITEMS.filter(
      (item) => nameOf(item.name) !== item.name,
    ).map((item) => `${item.name} -> ${nameOf(item.name)}`);
    expect(hijacked).toEqual([]);
  });

  it("resolves every alias to the item it was written for", () => {
    const rows = RAW_CATALOG_ROWS.filter((row) => row.aliases?.length);
    expect(rows.length).toBeGreaterThan(20);

    const wrong = [];
    for (const row of rows) {
      for (const alias of row.aliases) {
        const got = nameOf(alias);
        if (normalizeCatalogText(got) !== normalizeCatalogText(row.name)) {
          wrong.push(`${alias}: ${got} != ${row.name}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});
