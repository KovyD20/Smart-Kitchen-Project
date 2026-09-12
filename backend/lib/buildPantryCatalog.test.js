import { describe, it, expect, vi } from "vitest";
import {
  PRIORITY_RANK,
  buildPantryCatalog,
  collectAliases,
  normalizeCategory,
  readPurchase,
} from "./buildPantryCatalog.js";
import { normalizeCatalogText } from "./normalize.js";
import {
  RAW_CATALOG_ROWS,
  MANUAL_SYNONYMS,
  CATEGORY_ORDER,
} from "../scripts/pantrySeedData.js";

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

  it("follows a declared CATEGORY_ORDER instead of the row order", () => {
    const { categoryOrder } = buildPantryCatalog(
      [
        { category: "Szárazáru", name: "rizs" },
        { category: "Zöldségek", name: "só" },
        { category: "Pékáruk", name: "zsemle" },
      ],
      {},
      { categoryOrder: ["Zöldségek", "Pékáruk", "Szárazáru"] },
    );
    expect(categoryOrder).toEqual(["Zöldségek", "Pékáruk", "Szárazáru"]);
  });

  it("strips the list number on both sides before matching", () => {
    const { categoryOrder } = buildPantryCatalog(
      [
        { category: "9. Snackek", name: "keksz" },
        { category: "Zöldségek", name: "só" },
      ],
      {},
      { categoryOrder: ["9. Snackek", "Zöldségek"] },
    );
    expect(categoryOrder).toEqual(["Snackek", "Zöldségek"]);
  });

  it("warns about a category the order forgot, and puts it last", () => {
    const warn = vi.fn();
    const { categoryOrder } = buildPantryCatalog(
      [
        { category: "Pékáruk", name: "zsemle" },
        { category: "Halak", name: "lazac" },
        { category: "Zöldségek", name: "só" },
      ],
      {},
      { categoryOrder: ["Zöldségek", "Pékáruk"], warn },
    );

    // Behind the listed ones rather than dropped, so a forgotten category is
    // still shown -- but the warning is what says it needs a place.
    expect(categoryOrder).toEqual(["Zöldségek", "Pékáruk", "Halak"]);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain("Halak");
  });

  it("warns about an order entry no row uses", () => {
    const warn = vi.fn();
    buildPantryCatalog(
      [{ category: "Zöldségek", name: "só" }],
      {},
      { categoryOrder: ["Zöldségek", "Halak"], warn },
    );

    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain("Halak");
  });

  it("keeps unlisted categories in first-seen order behind the listed ones", () => {
    const { categoryOrder } = buildPantryCatalog(
      [
        { category: "Halak", name: "lazac" },
        { category: "Zöldségek", name: "só" },
        { category: "Borok", name: "rizling" },
      ],
      {},
      { categoryOrder: ["Zöldségek"], warn: () => {} },
    );
    expect(categoryOrder).toEqual(["Zöldségek", "Halak", "Borok"]);
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
      { warn },
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
  // The real CATEGORY_ORDER, and a warn that throws: an order that has drifted
  // from the rows reports through the same channel a broken synonym does, so it
  // has to fail this suite rather than print into a log nobody reads.
  const catalog = buildPantryCatalog(RAW_CATALOG_ROWS, MANUAL_SYNONYMS, {
    categoryOrder: CATEGORY_ORDER,
    warn: (message) => {
      throw new Error(message);
    },
  });

  const resolve = (name) => {
    const key = normalizeCatalogText(name);
    return catalog.aliasToEntry.get(key) || catalog.catalogByKey.get(key) || null;
  };

  it("walks the shop in the declared order", () => {
    expect(catalog.categoryOrder).toEqual([
      "Zöldségek",
      "Gyümölcsök",
      "Pékáruk",
      "Húsfélék",
      "Felvágottak",
      "Fagyasztott termékek",
      "Tejtermékek, tojás",
      "Üdítők, italok",
      "Snackek",
      "Fűszerek, ízesítők",
      "Szárazáru",
      "Háztartási alapcikkek (konyha)",
      "Háztartási alapcikkek (fürdő)",
    ]);
  });

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
    // "csokor" is a real shop unit: fresh herbs are sold by the bunch.
    const units = new Set([
      "db",
      "szem",
      "g",
      "dkg",
      "kg",
      "ml",
      "dl",
      "l",
      "csomag",
      "csokor",
    ]);
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
      "leveszöldségcsomag",
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
    // "zeller" is the bulb, not a fourth product: it used to be its own row and
    // opened a second line on the list whenever a recipe measured it in "fej"
    // rather than "db". It is an alias of the bulb now.
    expect(resolve("zeller").name).toBe("zellergumó");
    expect(resolve("petrezselyemgyökér").name).toBe("fehérrépa");
    // The bare name belongs to the dried spice; the bunch answers to "friss".
    expect(resolve("petrezselyem").category).toBe("Fűszerek, ízesítők");
    expect(resolve("friss petrezselyem").name).toBe("petrezselyem (zöldség)");
    // The greens sold for soup are the parsley bunch under another name; the
    // bagged soup mix is a different purchase and keeps its own row.
    expect(resolve("zöldségzöld").name).toBe("petrezselyem (zöldség)");
    expect(resolve("leveszöldség").name).toBe("leveszöldségcsomag");
  });

  // A2 — the two rows that used to be one "either/or" item each.
  it("sells the two salads as two products", () => {
    expect(resolve("fejes saláta").name).toBe("fejes saláta");
    expect(resolve("jégsaláta").name).toBe("jégsaláta");
    // A recipe that does not say which one means the butterhead.
    expect(resolve("saláta").name).toBe("fejes saláta");
    expect(resolve("madársaláta").name).toBe("madársaláta");
  });

  it("sells butter and margarine as two products", () => {
    expect(resolve("vaj").name).toBe("vaj");
    expect(resolve("margarin").name).toBe("margarin");
    expect(resolve("vaj").purchase).toEqual({ unit: "g", amount: 250 });
    expect(resolve("margarin").purchase).toEqual({ unit: "g", amount: 500 });
    // The one name that must not slide onto the butter row now that "vaj" is
    // an item of its own.
    expect(resolve("mogyoróvaj").name).toBe("mogyoróvaj");
  });

  // A1 — the six rows that had no package size, so the list showed the recipe's
  // own unit with nothing to round to.
  it("gives every row a package size", () => {
    const missing = Array.from(catalog.catalogByKey.values())
      .filter((entry) => !entry.purchase)
      .map((entry) => entry.name);
    expect(missing).toEqual([]);
  });

  // Without package data the shopping list has nothing to round to, so it can
  // only merge asks whose units convert into each other: "kakaópor 20 g" and
  // "kakaópor 4 ek" become two rows for the same item (see the hasPackage branch
  // in frontend/src/lib/inventory.js). These are the items recipes routinely ask
  // for in spoons, so losing their package size brings the duplicate rows back.
  it("gives a package size to everything recipes measure in spoons", () => {
    const missing = [
      "kakaópor",
      "sütőpor",
      "szódabikarbóna",
      "élesztő",
      "keményítő",
      "kardamom",
      "citromlé",
      "vaníliaaroma",
      "szárított tárkony",
      "lestyán",
      "levesgyöngy",
      "paradicsompüré",
      "sertészsír",
      "chiamag",
      "juharszirup",
      "zabpehely",
      "mogyoróvaj",
      "olívabogyó",
      "cukor",
      "porcukor",
      "fekete bors",
      "fahéj",
      "pirospaprika",
    ].filter((name) => !resolve(name)?.purchase);
    expect(missing).toEqual([]);
  });

  it("keeps ground coffee and 3in1 as products of their own", () => {
    // What you buy is ground coffee; 3in1 is sold separately on the shelf.
    expect(resolve("őrölt kávé")).toMatchObject({
      name: "őrölt kávé",
      category: "Üdítők, italok",
    });
    expect(resolve("presszó kávé").name).toBe("őrölt kávé");
    expect(resolve("presszókávé").name).toBe("őrölt kávé");
    expect(resolve("3in1 kávé").name).toBe("3in1 kávé");
    expect(resolve("3 in 1 kávé").name).toBe("3in1 kávé");
    expect(resolve("3-in-1 kávé").name).toBe("3in1 kávé");
    expect(resolve("kávé").name).toBe("kávé");
  });

  it("keeps dark chocolate apart from plain chocolate", () => {
    expect(resolve("étcsokoládé").name).toBe("étcsokoládé");
    expect(resolve("csokoládé").name).toBe("csokoládé");
  });

  it("treats kristálycukor as the plain sugar it is", () => {
    expect(resolve("kristálycukor").name).toBe("cukor");
  });

  it("leaves the state-modifier spellings to the input cleaner", () => {
    // "őrölt kardamom" and "őrölt fahéj" are not aliases on purpose: writing
    // every modifier x every spice by hand is the combinatorial explosion the
    // plan rules out. The word list strips the prefix generally, and the full
    // name is always tried first, which is what protects "őrölt kávé".
    expect(resolve("őrölt kardamom")).toBeNull();
    expect(resolve("kardamom").name).toBe("kardamom");
    expect(resolve("őrölt fahéj")).toBeNull();
    expect(resolve("fahéj").name).toBe("fahéj");
  });

  // The 41 rows that sat in the "Egyéb" bucket of a real shopping list on
  // 2026-09-09. Splitting them into "resolves now" and "waits for the input
  // cleaner" is what keeps the two fixes honest: the first list may only grow.
  describe("the 41 observed unresolved rows", () => {
    const RESOLVES = {
      akácméz: "méz",
      alaplé: "alaplé",
      balzsamecet: "balzsamecet",
      "barna cukor": "barna cukor",
      "cayenne bors": "cayenne bors",
      "cukrozatlan kakaópor": "cukrozatlan kakaópor",
      "darált sertéshús": "darált sertés",
      "dijoni mustár": "dijoni mustár",
      finomliszt: "liszt",
      "görög joghurt": "görög joghurt",
      "hegyes-erős paprika": "chili paprika",
      "jalapeno paprika": "jalapeno paprika",
      Kapor: "kapor",
      koriander: "koriander",
      kukoricakeményítő: "keményítő",
      marhalábszár: "marhahús",
      "nagy marha velőscsont": "velőscsont",
      passata: "paradicsompüré",
      "piros chilipaprika": "chili paprika",
      pulykamellfilé: "pulykamell",
      rókagomba: "rókagomba",
      "sertés rövidkaraj": "sertéskaraj",
      "szárított kakukkfű": "kakukkfű",
      "szárított petrezselyem": "petrezselyem",
      szárzeller: "zellerszár",
      "teljeskiőrlésű liszt": "teljeskiőrlésű liszt",
      Tök: "tök",
      vörösborecet: "vörösborecet",
      zellerzöld: "petrezselyem (zöldség)",
    };

    // Every one of these is a state modifier hiding a name the catalog already
    // has. They are deliberately NOT aliases: every modifier x every spice is
    // the combinatorial explosion the plan rules out. The input cleaner strips
    // the word instead, and then this list becomes empty.
    const WAITS_FOR_THE_INPUT_CLEANER = [
      "őrölt fahéj",
      "őrölt fekete bors",
      "őrölt kardamom",
      "őrölt kömény",
      "Szárított oregánó",
      "morzsolt oregánó",
      "Száraz fehérbor",
      "Száraz vörösbor",
      "Reszelt parmezán sajt",
      "friss vajas élesztős leveles tészta",
      "Víz",
      "víz",
    ];

    it("resolves 29 of them, each to the item named here", () => {
      const wrong = Object.entries(RESOLVES)
        .map(([input, expected]) => [input, expected, resolve(input)?.name])
        .filter(([, expected, actual]) => actual !== expected)
        .map(([input, expected, actual]) => `${input}: ${actual} != ${expected}`);
      expect(wrong).toEqual([]);
      expect(Object.keys(RESOLVES)).toHaveLength(29);
    });

    it("gives every one of them a package size, so no ask splits the row", () => {
      const missing = Object.keys(RESOLVES).filter(
        (input) => !resolve(input)?.purchase,
      );
      expect(missing).toEqual([]);
    });

    it("leaves the state-modifier spellings for the input cleaner", () => {
      const leaked = WAITS_FOR_THE_INPUT_CLEANER.filter((input) => resolve(input));
      expect(leaked).toEqual([]);
      expect(WAITS_FOR_THE_INPUT_CLEANER).toHaveLength(12);
    });

    it("accounts for all 41 rows", () => {
      expect(
        Object.keys(RESOLVES).length + WAITS_FOR_THE_INPUT_CLEANER.length,
      ).toBe(41);
    });
  });

  // Four herbs are sold both as a fresh bunch and as a dried sachet, and the
  // catalog carries both rows. A recipe that just names the herb should buy the
  // sachet — it keeps, and it is what a spoonful of dried herb means.
  //
  // This is not obvious from the rows alone: collectAliases() registers
  // "kapor" for "kapor (zöldség)" too, so both rows claim the bare name and
  // registerAlias() settles it by stock level. The spice row therefore has to
  // outrank the vegetable row, and this test is what says so out loud.
  describe("herbs that are both a vegetable and a spice", () => {
    const HERBS = ["petrezselyem", "kapor", "koriander", "bazsalikom"];

    it("gives the bare name to the dried spice", () => {
      const wrong = HERBS.map((herb) => [herb, resolve(herb)])
        .filter(([, hit]) => hit?.category !== "Fűszerek, ízesítők")
        .map(([herb, hit]) => `${herb}: ${hit?.name} (${hit?.category})`);
      expect(wrong).toEqual([]);
    });

    it("sells that spice by the sachet", () => {
      const wrong = HERBS.filter(
        (herb) => resolve(herb)?.purchase?.unit !== "csomag",
      );
      expect(wrong).toEqual([]);
    });

    it("keeps the fresh form reachable under a 'friss' alias", () => {
      const wrong = HERBS.map((herb) => [herb, resolve(`friss ${herb}`)])
        .filter(([, hit]) => hit?.category !== "Zöldségek")
        .map(([herb, hit]) => `friss ${herb}: ${hit?.name} (${hit?.category})`);
      expect(wrong).toEqual([]);
    });

    it("outranks the vegetable row, which is what breaks the tie", () => {
      const rows = new Map(RAW_CATALOG_ROWS.map((row) => [row.name, row]));
      const wrong = HERBS.filter(
        (herb) =>
          PRIORITY_RANK[rows.get(herb)?.priority] <=
          PRIORITY_RANK[rows.get(`${herb} (zöldség)`)?.priority],
      );
      expect(wrong).toEqual([]);
    });
  });

  it("does not add water to the catalog", () => {
    // Water belongs on no shopping list; it gets filtered out at list time.
    expect(resolve("víz")).toBeNull();
  });
});
