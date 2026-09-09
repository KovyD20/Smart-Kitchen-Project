import { describe, it, expect, vi } from "vitest";
import {
  buildPantryCatalog,
  collectAliases,
  normalizeCategory,
  readPurchase,
} from "./buildPantryCatalog.js";
import { normalizeCatalogText } from "./normalize.js";
import { RAW_CATALOG_ROWS, MANUAL_SYNONYMS } from "../scripts/pantrySeedData.js";

describe("normalizeCategory", () => {
  it("drops the leading list number the seed data still carries", () => {
    expect(normalizeCategory("9. Snackek")).toBe("Snackek");
    expect(normalizeCategory("10. Háztartási alapcikkek (konyha)")).toBe(
      "Háztartási alapcikkek (konyha)",
    );
    expect(normalizeCategory("Zöldségek")).toBe("Zöldségek");
  });
});

describe("readPurchase", () => {
  it("reads a complete package size", () => {
    expect(readPurchase({ purchaseUnit: "kg", purchaseAmount: 1 })).toEqual({
      unit: "kg",
      amount: 1,
    });
  });

  it("drops half-filled or nonsensical package data", () => {
    expect(readPurchase({ purchaseUnit: "kg" })).toBeNull();
    expect(readPurchase({ purchaseAmount: 500 })).toBeNull();
    expect(readPurchase({ purchaseUnit: "g", purchaseAmount: 0 })).toBeNull();
    expect(readPurchase({ purchaseUnit: "g", purchaseAmount: -5 })).toBeNull();
    expect(readPurchase({})).toBeNull();
  });
});

describe("collectAliases", () => {
  it("derives the parenthesised and slash-separated forms of a name", () => {
    // Note the two ragged halves: the slash split is applied to the full name as
    // well as to the parenthesised part, so "saláta (jégsaláta" comes out too.
    // Long-standing behaviour, and harmless — they normalize to keys nobody
    // types — but this is where it is visible rather than only in the database.
    expect(collectAliases({ name: "saláta (jégsaláta / fejes)" }).sort()).toEqual(
      [
        "fejes",
        "fejes)",
        "jégsaláta",
        "saláta",
        "saláta (jégsaláta",
        "saláta (jégsaláta / fejes)",
      ].sort(),
    );
    expect(collectAliases({ name: "vaj / margarin" }).sort()).toEqual(
      ["margarin", "vaj", "vaj / margarin"].sort(),
    );
  });

  it("merges the hand-written aliases in", () => {
    expect(collectAliases({ name: "gomba", aliases: ["csiperkegomba"] })).toEqual([
      "gomba",
      "csiperkegomba",
    ]);
  });

  it("takes hand-written aliases literally, without deriving from them", () => {
    // "piros paprika" must not also register "piros" or "paprika": the plain
    // vegetable lives in another category, and that is the whole reason this
    // alias is written by hand.
    expect(
      collectAliases({ name: "pirospaprika", aliases: ["piros paprika"] }),
    ).toEqual(["pirospaprika", "piros paprika"]);
  });

  it("ignores blank aliases and blank names", () => {
    expect(collectAliases({ name: "só", aliases: ["", "  ", null] })).toEqual(["só"]);
    expect(collectAliases({ name: "" })).toEqual([]);
    expect(collectAliases({})).toEqual([]);
  });
});

describe("buildPantryCatalog", () => {
  it("keeps categories in first-seen order, with the list number stripped", () => {
    const { categoryOrder } = buildPantryCatalog([
      { category: "Zöldségek", name: "só" },
      { category: "9. Snackek", name: "keksz" },
      { category: "Zöldségek", name: "bors" },
    ]);
    expect(categoryOrder).toEqual(["Zöldségek", "Snackek"]);
  });

  it("merges duplicate names, keeping the higher stock level and the package data", () => {
    const { catalogByKey } = buildPantryCatalog([
      { category: "Szárazáru", name: "rizs", priority: "extra" },
      {
        category: "Szárazáru",
        name: "Rizs",
        priority: "essential",
        purchaseAmount: 1,
        purchaseUnit: "kg",
      },
    ]);
    expect(catalogByKey.size).toBe(1);
    expect(catalogByKey.get("rizs")).toMatchObject({
      name: "rizs",
      priority: "essential",
      purchase: { unit: "kg", amount: 1 },
    });
  });

  it("warns instead of silently skipping a synonym whose target is gone", () => {
    const warn = vi.fn();
    buildPantryCatalog(
      [{ category: "Zöldségek", name: "burgonya" }],
      { krumpli: "burgonya", kripli: "nincs ilyen" },
      warn,
    );

    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain("kripli");
  });

  it("points a synonym at the item its canonical name resolves to", () => {
    const { aliasToEntry } = buildPantryCatalog(
      [{ category: "Zöldségek", name: "burgonya" }],
      { krumpli: "burgonya" },
    );
    expect(aliasToEntry.get("krumpli").key).toBe("burgonya");
  });
});

// The seed data is ~240 hand-written rows and ~60 hand-written aliases. These
// walk the real data, because a typo in it fails nothing else.
describe("the real seed data", () => {
  const catalog = buildPantryCatalog(RAW_CATALOG_ROWS, MANUAL_SYNONYMS, (message) => {
    throw new Error(message);
  });

  const resolve = (name) => {
    const key = normalizeCatalogText(name);
    return catalog.aliasToEntry.get(key) || catalog.catalogByKey.get(key) || null;
  };

  it("has a category, a name and a known stock level on every row", () => {
    const bad = RAW_CATALOG_ROWS.filter(
      (row) =>
        !row.category ||
        !row.name ||
        !["essential", "good_to_have", "extra"].includes(row.priority),
    );
    expect(bad).toEqual([]);
  });

  it("has no two rows normalizing to the same key", () => {
    const seen = new Map();
    const collisions = [];
    for (const row of RAW_CATALOG_ROWS) {
      const key = normalizeCatalogText(row.name);
      if (seen.has(key)) collisions.push(`${seen.get(key)} / ${row.name}`);
      else seen.set(key, row.name);
    }
    expect(collisions).toEqual([]);
  });

  it("has no alias that shadows a different item's own key", () => {
    // resolveCatalogKey checks the alias index before the item index, so an
    // alias colliding with another item's key would hide that item entirely.
    const shadowed = [];
    for (const [aliasKey, entry] of catalog.aliasToEntry) {
      const item = catalog.catalogByKey.get(aliasKey);
      if (item && item.key !== entry.key) {
        shadowed.push(`${aliasKey}: ${item.name} shadowed by ${entry.name}`);
      }
    }
    expect(shadowed).toEqual([]);
  });

  it("has package data that names a real unit", () => {
    const units = new Set(["db", "szem", "g", "dkg", "kg", "ml", "dl", "l", "csomag"]);
    const bad = Array.from(catalog.catalogByKey.values())
      .filter((entry) => entry.purchase && !units.has(entry.purchase.unit))
      .map((entry) => `${entry.name}: ${entry.purchase.unit}`);
    expect(bad).toEqual([]);
  });

  // 2.1 — the typos. The misspelling stays reachable so rows already written
  // that way keep resolving.
  it("resolves the fixed typos and their old spellings", () => {
    expect(resolve("parmezán").name).toBe("parmezán");
    expect(resolve("pamezán").name).toBe("parmezán");
    expect(resolve("vaníliás cukor").name).toBe("vaníliás cukor");
    expect(resolve("vanilliacukor").name).toBe("vaníliás cukor");
  });

  it("keeps ground paprika out of the vegetable aisle", () => {
    // The trap: token matching would send "piros paprika" to the vegetable
    // `paprika`. It has to stay an exact alias of the spice.
    expect(resolve("piros paprika")).toMatchObject({
      name: "pirospaprika",
      category: "Fűszerek, ízesítők",
    });
    expect(resolve("fűszerpaprika").name).toBe("pirospaprika");
    expect(resolve("őrölt paprika").name).toBe("pirospaprika");
    expect(resolve("paprika")).toMatchObject({
      name: "paprika",
      category: "Zöldségek",
    });
    expect(resolve("zöldpaprika").name).toBe("paprika");
  });

  it("files minced meat under Húsfélék, not with the cold cuts", () => {
    expect(resolve("darált hús")).toMatchObject({
      name: "darált hús",
      category: "Húsfélék",
    });
    expect(resolve("darálthús").name).toBe("darált hús");
  });

  it("resolves the remaining 2.1 aliases", () => {
    expect(resolve("paradicsom konzerv").name).toBe("konzerv paradicsom");
    expect(resolve("garnélarák").name).toBe("garnéla");
    expect(resolve("olaj").name).toBe("étolaj");
    expect(resolve("napraforgóolaj").name).toBe("étolaj");
  });

  it("leaves 'zsír' unresolved on purpose", () => {
    // Lard is not cooking oil, and "olaj vagy zsír" is a phrasing problem for
    // the input-cleaning phase, not something to guess at here.
    expect(resolve("zsír")).toBeNull();
  });

  // 2.2 — the hand-written aliases.
  it("resolves the product-qualifier aliases", () => {
    expect(resolve("csirkemell filé").name).toBe("csirkemell");
    expect(resolve("csirkemellfilé").name).toBe("csirkemell");
    expect(resolve("marhahús (szegy vagy lábszár)").name).toBe("marhahús");
    expect(resolve("tejszín (30%-os)").name).toBe("tejszín");
    expect(resolve("serrano sonka").name).toBe("sonka");
    expect(resolve("holland kakaópor").name).toBe("kakaópor");
    expect(resolve("ciabatta kenyér").name).toBe("kenyér");
    expect(resolve("bors").name).toBe("fekete bors");
    expect(resolve("csiperkegomba").name).toBe("gomba");
  });

  // 2.3 — the new items. These are products of their own, not aliases.
  it("has the new items as separate products", () => {
    for (const name of [
      "chiamag",
      "citromlé",
      "gyömbér",
      "juharszirup",
      "lestyán",
      "levesgyöngy",
      "mandulatej",
      "olívabogyó",
      "paradicsompüré",
      "sertészsír",
      "szárított tárkony",
      "tyúk",
      "vaníliaaroma",
      "zöldségzöld",
      "fehérrépa",
      "Manchego sajt",
      "főzőtejszín",
      "zellergumó",
      "zellerszár",
    ]) {
      const entry = resolve(name);
      expect(entry, `missing item: ${name}`).not.toBeNull();
      expect(entry.key, `${name} resolved to ${entry?.name}`).toBe(
        normalizeCatalogText(name),
      );
    }
  });

  it("keeps the celery and parsley products apart", () => {
    expect(resolve("zellerszár").name).toBe("zellerszár");
    expect(resolve("zellergumó").name).toBe("zellergumó");
    expect(resolve("zeller").name).toBe("zeller");
    expect(resolve("petrezselyemgyökér").name).toBe("fehérrépa");
    expect(resolve("petrezselyem").name).toBe("petrezselyem (zöldség)");
  });

  it("does not add water to the catalog", () => {
    // Water belongs on no shopping list; it gets filtered out at list time.
    expect(resolve("víz")).toBeNull();
  });
});
