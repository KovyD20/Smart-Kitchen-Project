import { SYSTEM_UNITS, UNIT_ALIASES } from "../constants/units";

// Pure unit / measurement helpers, extracted from Home.jsx so they can be shared
// and unit-tested. No React or catalog dependencies.

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The lookup key of a unit: lowercase, accent-free, with dots, spaces and
// hyphens removed. Both the alias table and the incoming value go through this
// same function, so a table entry can never drift out of reach of the input that
// is supposed to find it. Exported so the invariant can be tested.
export function unitLookupKey(value) {
  const raw = (value || "").toString().trim().toLocaleLowerCase("hu-HU");
  const ascii = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ascii.replace(/\./g, "").replace(/[\s-]+/g, "").trim();
}

// The alias table itself stays readable in constants/units.js, in its accented
// source form; only the lookup keys are normalized. The *values* keep their
// accents on purpose — they are what gets displayed, so "2 pohar" is written
// back out as "2 pohár".
const UNIT_LOOKUP = Object.fromEntries(
  Object.entries(UNIT_ALIASES).map(([alias, unit]) => [unitLookupKey(alias), unit]),
);

// Longest-first so multi-char unit tokens win over shorter prefixes when matched.
// Normalized too, because stripAmountsAndUnits matches them against text it has
// already stripped the accents from.
const UNIT_TOKENS = Array.from(
  new Set([...SYSTEM_UNITS, ...Object.keys(UNIT_ALIASES)].map(unitLookupKey)),
)
  .filter(Boolean)
  .sort((a, b) => b.length - a.length);

const UNIT_TOKEN_PATTERN = UNIT_TOKENS.map(escapeRegex).join("|");

// Strips a raw name down to a comparable core: lowercase, accent-free, with
// embedded amounts and unit tokens removed. Catalog resolution (resolveCatalogKey)
// is applied separately by the caller.
export function stripAmountsAndUnits(value) {
  const base = (value || "").toString().trim().toLocaleLowerCase("hu-HU");
  const ascii = base.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const unitRegex = UNIT_TOKEN_PATTERN
    ? new RegExp(`(\\d+([.,]\\d+)?)(\\s*)(${UNIT_TOKEN_PATTERN})\\b`, "g")
    : null;

  const withoutNumbers = ascii
    .replace(unitRegex || /$^/, " ")
    .replace(/\b\d+([.,]\d+)?\b/g, " ")
    .replace(/[()\-_,.;:!+]/g, " ");

  return withoutNumbers.replace(/\s+/g, " ").trim();
}

export function normalizeUnit(value) {
  const key = unitLookupKey(value);
  if (!key) return "";
  return UNIT_LOOKUP[key] || key;
}

// Only the units that can be converted to one another have a kind and a factor
// here. The rest — csipet, csokor, gerezd, szelet, fej, szál, marék, bögre,
// pohár, csomag, konzerv — are left out on purpose: there is no honest factor
// from a pinch or a clove to a gram, so they merge only with themselves and
// otherwise count as "one package needed". Do not invent factors for them.
//
// "szem" is a kind of counting, so it gets kind: "count", but count units are
// never compatible across different units (see areUnitsCompatible) — ten
// peppercorns must not turn into ten pieces of pepper.
const UNIT_INFO = {
  g: { kind: "mass", factor: 1 },
  dkg: { kind: "mass", factor: 10 },
  kg: { kind: "mass", factor: 1000 },
  ml: { kind: "volume", factor: 1 },
  dl: { kind: "volume", factor: 100 },
  l: { kind: "volume", factor: 1000 },
  db: { kind: "count", factor: 1 },
  szem: { kind: "count", factor: 1 },
};

export function unitInfo(unit) {
  const u = normalizeUnit(unit);
  return { unit: u, ...UNIT_INFO[u] };
}

// Mass converts to mass and volume to volume; everything else only merges with
// its own unit. "count" is deliberately not convertible within its kind — db and
// szem are both counting, with no rate between them.
export function areUnitsCompatible(a, b) {
  if (!a || !b) return false;
  if (a.unit === b.unit) return true;
  if (!a.kind || !b.kind) return false;
  return a.kind === b.kind && (a.kind === "mass" || a.kind === "volume");
}

export function convertAmount(amount, fromInfo, toInfo) {
  if (!fromInfo || !toInfo) return amount;
  if (fromInfo.unit === toInfo.unit) return amount;
  if (!areUnitsCompatible(fromInfo, toInfo)) return amount;
  return (Number(amount) || 0) * (fromInfo.factor / toInfo.factor);
}

const MAX_PURCHASE_PACKAGES = 20;
// Guards the ceil() against float dust: 1000 g -> kg must stay 1 package.
const PACKAGE_EPSILON = 1e-9;

// Trims the float dust a chain of unit conversions leaves behind, without
// touching quantities that are legitimately fractional (0.5 kg stays 0.5 kg).
// Exported because every branch that sums two amounts needs it: a merge that
// skips it is how "passata 3.8000000000000007 l" reached the list.
export function trimFloat(value) {
  return Math.round(value * 1000) / 1000;
}

// Units that come one at a time: half a "db" is not a quantity a shop will sell
// you. Spoons are deliberately absent — "fél tk só" is a real ask — and so are
// mass and volume, where 0,5 kg is exactly what the user meant.
const WHOLE_ONLY_UNITS = new Set(
  [
    "db",
    "szem",
    "csomag",
    "konzerv",
    "fej",
    "szál",
    "csokor",
    "gerezd",
    "szelet",
    "csipet",
    "bögre",
    "pohár",
    "marék",
  ].map(unitLookupKey),
);

// Rounds a hand-entered amount up to something buyable. The recipe path already
// rounds to whole packages in accumulatePurchase(); this is the manual path,
// where the number the user typed stands as their intent and only an indivisible
// unit is nudged: "0,5 db" is not a purchase, "0,5 kg" is.
export function roundToBuyableAmount(amount, unit) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return value;
  // Through normalizeUnit first, so "darab" is the same answer as "db".
  if (!WHOLE_ONLY_UNITS.has(unitLookupKey(normalizeUnit(unit)))) return value;
  return Math.ceil(trimFloat(value));
}

// Rounding each recipe's ask to a whole package and *then* adding the results up
// buys eleven kilos of salt for eleven recipes that each wanted a pinch. The sum
// has to come first and the rounding exactly once, at the end — which is what
// this does, across calls as well as within one.
//
//   asks     - raw recipe quantities to add now, [{ amount, unit }]
//   purchase - smallest package from the catalog ({ unit, amount }), or null
//   previous - what the list already accumulated for this item, as returned in
//              `source` by an earlier call ({ amount, unit, loose }), or null
//
// An ask measured in a unit the package cannot be converted to — a pinch against
// a kilo bag — cannot be added to anything. It only proves the item is needed,
// and that is one package however often it recurs; `loose` carries that fact
// forward so a later call does not count it again.
//
// Returns { amount, unit, source, rounded }: the quantity to buy, and the
// running raw total to store alongside it. `source` is null when there is
// nothing to remember (no package data, or nothing accumulated), and `rounded`
// says whether `amount` differs from the raw asks — the shopping list uses it to
// decide if the "recept: 500 g" note is worth showing.
export function accumulatePurchase(asks, purchase, previous = null) {
  const list = (Array.isArray(asks) ? asks : [])
    .map((ask) => ({ amount: Number(ask?.amount), unit: normalizeUnit(ask?.unit) }))
    .filter((ask) => Number.isFinite(ask.amount) && ask.amount > 0);

  const packageAmount = Number(purchase?.amount);
  const packageUnit = normalizeUnit(purchase?.unit);
  const hasPackage =
    Boolean(packageUnit) && Number.isFinite(packageAmount) && packageAmount > 0;

  // No package data: there is nothing to round to, so this is a plain sum in the
  // unit of the first ask. Asks in an incompatible unit cannot join that sum and
  // are dropped here — the caller has already split them into their own group.
  if (!hasPackage) {
    if (list.length === 0) return { amount: 0, unit: "", source: null, rounded: false };

    const target = unitInfo(list[0].unit);
    let sum = 0;
    for (const ask of list) {
      const from = unitInfo(ask.unit);
      if (!areUnitsCompatible(from, target)) continue;
      sum += convertAmount(ask.amount, from, target);
    }
    return {
      amount: trimFloat(sum),
      unit: target.unit,
      source: null,
      rounded: false,
    };
  }

  const to = unitInfo(packageUnit);

  // The running total is kept in the unit the recipes were written in, not in
  // the package unit, so the "recept: 500 g" note still reads the way the recipe
  // did rather than as "recept: 0.5 kg".
  let totalUnit = previous?.amount > 0 ? normalizeUnit(previous.unit) : "";
  let total = previous?.amount > 0 ? Number(previous.amount) : 0;
  let loose = Boolean(previous?.loose);

  for (const ask of list) {
    const from = unitInfo(ask.unit);
    if (!areUnitsCompatible(from, to)) {
      loose = true;
      continue;
    }
    if (!totalUnit) {
      totalUnit = from.unit;
      total = ask.amount;
      continue;
    }
    total += convertAmount(ask.amount, from, unitInfo(totalUnit));
  }
  total = trimFloat(total);

  const source =
    total > 0
      ? { amount: total, unit: totalUnit, ...(loose ? { loose: true } : {}) }
      : loose
        ? { amount: 0, unit: "", loose: true }
        : null;

  const convertedTotal =
    total > 0 ? convertAmount(total, unitInfo(totalUnit), to) : 0;
  let packages =
    convertedTotal > 0
      ? Math.ceil(convertedTotal / packageAmount - PACKAGE_EPSILON)
      : 0;
  // A pinch of salt is not a measurable fraction of a kilo bag, but it is still
  // a reason to buy one.
  if (loose) packages = Math.max(packages, 1);

  if (packages <= 0) return { amount: 0, unit: packageUnit, source, rounded: false };

  // 20+ packages is far more likely to be bad data than a real shopping need, so
  // hand back the raw total rather than put 25 kg on the list.
  if (packages > MAX_PURCHASE_PACKAGES) {
    console.warn(
      `accumulatePurchase: ${total} ${totalUnit} is ${packages} x ${packageAmount} ${packageUnit} — leaving the amount unchanged.`,
    );
    return { amount: total, unit: totalUnit, source, rounded: false };
  }

  const amount = trimFloat(packages * packageAmount);
  return {
    amount,
    unit: packageUnit,
    source,
    rounded: amount !== total || packageUnit !== totalUnit,
  };
}
