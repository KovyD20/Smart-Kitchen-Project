import { describe, it, expect, vi, afterEach } from "vitest";
import {
  normalizeUnit,
  unitLookupKey,
  unitInfo,
  areUnitsCompatible,
  convertAmount,
  stripAmountsAndUnits,
  accumulatePurchase,
} from "./units.js";
import { SYSTEM_UNITS, UNIT_ALIASES } from "../constants/units.js";

describe("normalizeUnit", () => {
  it("maps aliases to their canonical short form", () => {
    expect(normalizeUnit("g")).toBe("g");
    expect(normalizeUnit("gramm")).toBe("g");
    expect(normalizeUnit("darab")).toBe("db");
  });

  it("strips dots and surrounding whitespace/hyphens", () => {
    expect(normalizeUnit("ml.")).toBe("ml");
    expect(normalizeUnit("  kg ")).toBe("kg");
  });

  it("returns the cleaned value for unknown units, and empty for empty input", () => {
    expect(normalizeUnit("xyz")).toBe("xyz");
    expect(normalizeUnit("")).toBe("");
  });

  it("resolves the spelled-out liter", () => {
    // Regression: "Víz 3 liter" and "víz 51 dl" used to sit on the list twice.
    expect(normalizeUnit("liter")).toBe("l");
    expect(normalizeUnit("LITER")).toBe("l");
    expect(normalizeUnit("l")).toBe("l");
  });

  it("resolves accented aliases", () => {
    expect(normalizeUnit("teáskanál")).toBe("tk");
    expect(normalizeUnit("kiskanál")).toBe("tk");
    expect(normalizeUnit("evőkanál")).toBe("ek");
  });

  it("resolves the same aliases typed without accents", () => {
    expect(normalizeUnit("teaskanal")).toBe("tk");
    expect(normalizeUnit("evokanal")).toBe("ek");
  });

  it("ignores case and surrounding whitespace on an accented alias", () => {
    expect(normalizeUnit("EVŐKANÁL ")).toBe("ek");
    expect(normalizeUnit(" Teáskanál")).toBe("tk");
  });

  it("gives back the accented display form of a unit typed without accents", () => {
    // Regression: the list used to read "Olívabogyó 1 pohar" and "Zellerszár 2 szal".
    expect(normalizeUnit("pohar")).toBe("pohár");
    expect(normalizeUnit("szal")).toBe("szál");
    expect(normalizeUnit("marek")).toBe("marék");
    expect(normalizeUnit("bogre")).toBe("bögre");
  });

  // These two are the tests that matter: they fail the moment someone adds an
  // alias or a dropdown unit that normalizeUnit cannot reach, which is exactly
  // how the seven accented aliases stayed silently dead.
  it("resolves every alias in the table", () => {
    for (const [alias, unit] of Object.entries(UNIT_ALIASES)) {
      expect(normalizeUnit(alias), `alias ${alias}`).toBe(unit);
    }
  });

  it("is idempotent on every canonical unit and every dropdown unit", () => {
    for (const unit of [...Object.values(UNIT_ALIASES), ...SYSTEM_UNITS]) {
      expect(normalizeUnit(unit), `unit ${unit}`).toBe(unit);
    }
  });
});

describe("unitLookupKey", () => {
  it("strips accents, case, dots, spaces and hyphens", () => {
    expect(unitLookupKey("Teáskanál")).toBe("teaskanal");
    expect(unitLookupKey(" ml. ")).toBe("ml");
    expect(unitLookupKey("kis-kanál")).toBe("kiskanal");
  });

  it("returns an empty key for empty input", () => {
    expect(unitLookupKey("")).toBe("");
    expect(unitLookupKey(null)).toBe("");
    expect(unitLookupKey(undefined)).toBe("");
  });
});

describe("unitInfo", () => {
  it("returns kind and factor for known units", () => {
    expect(unitInfo("g")).toEqual({ unit: "g", kind: "mass", factor: 1 });
    expect(unitInfo("kg")).toEqual({ unit: "kg", kind: "mass", factor: 1000 });
    expect(unitInfo("l")).toEqual({ unit: "l", kind: "volume", factor: 1000 });
    expect(unitInfo("db")).toEqual({ unit: "db", kind: "count", factor: 1 });
  });

  it("returns only the unit for unknown units (no kind/factor)", () => {
    expect(unitInfo("xyz")).toEqual({ unit: "xyz" });
  });

  it("knows szem as a counting unit", () => {
    expect(unitInfo("szem")).toEqual({ unit: "szem", kind: "count", factor: 1 });
  });

  it("leaves the unconvertible units without a kind on purpose", () => {
    // No honest factor exists from a pinch or a clove to a gram, so these must
    // stay kind-less rather than gain an invented conversion.
    for (const unit of ["csipet", "csokor", "gerezd", "szelet", "fej", "szál", "marék"]) {
      expect(unitInfo(unit), `unit ${unit}`).toEqual({ unit });
    }
  });
});

describe("areUnitsCompatible", () => {
  it("is true for the same unit", () => {
    expect(areUnitsCompatible(unitInfo("g"), unitInfo("g"))).toBe(true);
    expect(areUnitsCompatible(unitInfo("db"), unitInfo("db"))).toBe(true);
  });

  it("is true within the same measurable kind (mass/volume)", () => {
    expect(areUnitsCompatible(unitInfo("g"), unitInfo("kg"))).toBe(true);
    expect(areUnitsCompatible(unitInfo("ml"), unitInfo("l"))).toBe(true);
  });

  it("is false across different kinds or when a kind is missing", () => {
    expect(areUnitsCompatible(unitInfo("g"), unitInfo("ml"))).toBe(false);
    expect(areUnitsCompatible(unitInfo("g"), unitInfo("xyz"))).toBe(false);
  });

  it("does not merge two different counting units", () => {
    // Ten peppercorns are not ten pieces of pepper.
    expect(areUnitsCompatible(unitInfo("szem"), unitInfo("db"))).toBe(false);
    expect(areUnitsCompatible(unitInfo("szem"), unitInfo("szem"))).toBe(true);
    expect(convertAmount(10, unitInfo("szem"), unitInfo("db"))).toBe(10);
  });

  it("does not merge a pinch into a mass", () => {
    expect(areUnitsCompatible(unitInfo("csipet"), unitInfo("g"))).toBe(false);
    expect(areUnitsCompatible(unitInfo("gerezd"), unitInfo("db"))).toBe(false);
  });
});

describe("convertAmount", () => {
  it("converts between compatible units", () => {
    expect(convertAmount(1000, unitInfo("g"), unitInfo("kg"))).toBe(1);
    expect(convertAmount(1, unitInfo("dkg"), unitInfo("g"))).toBe(10);
  });

  it("returns the amount unchanged for same or incompatible units", () => {
    expect(convertAmount(7, unitInfo("g"), unitInfo("g"))).toBe(7);
    expect(convertAmount(5, unitInfo("g"), unitInfo("ml"))).toBe(5);
  });

  it("handles zero and negative amounts", () => {
    expect(convertAmount(0, unitInfo("g"), unitInfo("kg"))).toBe(0);
    expect(convertAmount(-2000, unitInfo("g"), unitInfo("kg"))).toBe(-2);
  });
});

describe("stripAmountsAndUnits", () => {
  it("removes embedded amounts and unit tokens", () => {
    expect(stripAmountsAndUnits("2 kg liszt")).toBe("liszt");
    expect(stripAmountsAndUnits("3db tojás")).toBe("tojas");
    expect(stripAmountsAndUnits("10 szem bors")).toBe("bors");
    expect(stripAmountsAndUnits("3 liter víz")).toBe("viz");
  });

  it("lowercases and strips accents", () => {
    expect(stripAmountsAndUnits("Vöröshagyma")).toBe("voroshagyma");
  });

  it("removes unit tokens written with accents", () => {
    // The token list is matched against already-deaccented text, so an accented
    // token was unreachable here for the same reason the aliases were.
    expect(stripAmountsAndUnits("1 bögre liszt")).toBe("liszt");
    expect(stripAmountsAndUnits("2 szál zeller")).toBe("zeller");
    expect(stripAmountsAndUnits("1 teáskanál só")).toBe("so");
  });
});

describe("accumulatePurchase", () => {
  const KILO = { unit: "kg", amount: 1 };
  const TUB = { unit: "g", amount: 330 };
  const TEN_EGGS = { unit: "db", amount: 10 };

  afterEach(() => vi.restoreAllMocks());

  it("adds the asks up before rounding, not after", () => {
    // Three 200 g asks are 600 g, which is two 330 g tubs. Rounding each ask on
    // its own would have bought three.
    expect(
      accumulatePurchase(
        [
          { amount: 200, unit: "g" },
          { amount: 200, unit: "g" },
          { amount: 200, unit: "g" },
        ],
        TUB,
      ),
    ).toEqual({
      amount: 660,
      unit: "g",
      source: { amount: 600, unit: "g" },
      rounded: true,
    });
  });

  it("buys a single package for any number of unmeasurable asks", () => {
    // The reported bug: eleven pinches of salt bought eleven kilos.
    const asks = Array.from({ length: 11 }, () => ({ amount: 1, unit: "csipet" }));

    expect(accumulatePurchase(asks, KILO)).toEqual({
      amount: 1,
      unit: "kg",
      source: { amount: 0, unit: "", loose: true },
      rounded: true,
    });
  });

  it("carries the running total across calls", () => {
    const first = accumulatePurchase([{ amount: 200, unit: "g" }], TUB);
    expect(first.amount).toBe(330);

    const second = accumulatePurchase([{ amount: 200, unit: "g" }], TUB, first.source);
    expect(second).toEqual({
      amount: 660,
      unit: "g",
      source: { amount: 400, unit: "g" },
      rounded: true,
    });
  });

  it("keeps a remembered pinch from buying a second package later", () => {
    const first = accumulatePurchase([{ amount: 1, unit: "csipet" }], KILO);
    expect(first.amount).toBe(1);

    // 500 g is still under one kilo, and the pinch does not add to it.
    const second = accumulatePurchase([{ amount: 500, unit: "g" }], KILO, first.source);
    expect(second).toEqual({
      amount: 1,
      unit: "kg",
      source: { amount: 500, unit: "g", loose: true },
      rounded: true,
    });
  });

  it("converts compatible asks into the unit of the first one", () => {
    expect(
      accumulatePurchase(
        [
          { amount: 500, unit: "g" },
          { amount: 1, unit: "kg" },
        ],
        KILO,
      ),
    ).toEqual({
      amount: 2,
      unit: "kg",
      source: { amount: 1500, unit: "g" },
      rounded: true,
    });
  });

  it("rounds a whole number of packages to exactly that many", () => {
    expect(accumulatePurchase([{ amount: 1000, unit: "g" }], KILO)).toEqual({
      amount: 1,
      unit: "kg",
      source: { amount: 1000, unit: "g" },
      rounded: true,
    });
  });

  it("reports no rounding when the total already is the package quantity", () => {
    expect(accumulatePurchase([{ amount: 10, unit: "db" }], TEN_EGGS)).toEqual({
      amount: 10,
      unit: "db",
      source: { amount: 10, unit: "db" },
      rounded: false,
    });
  });

  it("sums without rounding when the item has no package data", () => {
    expect(
      accumulatePurchase(
        [
          { amount: 1, unit: "csokor" },
          { amount: 2, unit: "csokor" },
        ],
        null,
      ),
    ).toEqual({ amount: 3, unit: "csokor", source: null, rounded: false });
  });

  it("merges a spelled-out liter with an ask in dl", () => {
    // The D4 duplicate: "Víz 3 liter" and "víz 51 dl" are one 8.1 l line.
    expect(
      accumulatePurchase(
        [
          { amount: 3, unit: "liter" },
          { amount: 51, unit: "dl" },
        ],
        null,
      ),
    ).toEqual({ amount: 8.1, unit: "l", source: null, rounded: false });
  });

  it("treats an ask in szem as one package of a mass-packaged item", () => {
    // "10 szem bors" cannot be weighed, but it does mean pepper is needed.
    expect(accumulatePurchase([{ amount: 10, unit: "szem" }], { unit: "g", amount: 20 })).toEqual({
      amount: 20,
      unit: "g",
      source: { amount: 0, unit: "", loose: true },
      rounded: true,
    });
  });

  it("ignores asks with no usable quantity", () => {
    expect(
      accumulatePurchase(
        [
          { amount: 0, unit: "g" },
          { amount: -5, unit: "g" },
          { amount: "abc", unit: "g" },
          { amount: 500, unit: "g" },
        ],
        KILO,
      ).amount,
    ).toBe(1);
  });

  it("returns nothing for an empty ask list", () => {
    expect(accumulatePurchase([], KILO)).toEqual({
      amount: 0,
      unit: "kg",
      source: null,
      rounded: false,
    });
  });

  it("hands back the raw total rather than an implausible package count", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(accumulatePurchase([{ amount: 25, unit: "kg" }], KILO)).toEqual({
      amount: 25,
      unit: "kg",
      source: { amount: 25, unit: "kg" },
      rounded: false,
    });
    expect(warn).toHaveBeenCalledOnce();
  });
});
