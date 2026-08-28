import { SYSTEM_UNITS, UNIT_ALIASES } from "../constants/units";

// Pure unit / measurement helpers, extracted from Home.jsx so they can be shared
// and unit-tested. No React or catalog dependencies.

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Longest-first so multi-char unit tokens win over shorter prefixes when matched.
const UNIT_TOKENS = Array.from(
  new Set([...SYSTEM_UNITS, ...Object.keys(UNIT_ALIASES)]),
).sort((a, b) => b.length - a.length);

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
  const raw = (value || "").toString().trim().toLocaleLowerCase("hu-HU");
  if (!raw) return "";
  const ascii = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleaned = ascii.replace(/\./g, "").replace(/[\s-]+/g, "").trim();
  return UNIT_ALIASES[cleaned] || cleaned;
}

export function unitInfo(unit) {
  const u = normalizeUnit(unit);
  const table = {
    g: { kind: "mass", factor: 1 },
    dkg: { kind: "mass", factor: 10 },
    kg: { kind: "mass", factor: 1000 },
    ml: { kind: "volume", factor: 1 },
    dl: { kind: "volume", factor: 100 },
    l: { kind: "volume", factor: 1000 },
    db: { kind: "count", factor: 1 },
  };
  return { unit: u, ...table[u] };
}

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

// A recipe asks for "2 tk cukor"; the shop sells it by the kilo. Rounds an
// ingredient quantity up to whole packages of the item's smallest purchasable
// size (`purchase` = { unit, amount } from the catalog, or null when unknown).
//
// Returns { amount, unit, rounded } — `rounded` is false whenever the original
// quantity is handed back untouched, which is what the shopping list uses to
// decide if the "recept: 2 tk" note is worth showing.
//
// Three cases:
//   - convertible units (g -> kg, ml -> l, db -> db): convert, then round up to
//     the next whole package (500 g flour -> 1 kg, 1200 g -> 2 kg);
//   - non-convertible units (tk, ek, csipet, gerezd... -> kg): there is no
//     arithmetic between a teaspoon and a kilo, so one package is the answer;
//   - no package data, no quantity, or an implausible package count: unchanged.
const MAX_PURCHASE_PACKAGES = 20;
// Guards the ceil() against float dust: 1000 g -> kg must stay 1 package.
const PACKAGE_EPSILON = 1e-9;

export function toPurchaseAmount(amount, unit, purchase) {
  const original = { amount, unit, rounded: false };

  const packageAmount = Number(purchase?.amount);
  const packageUnit = normalizeUnit(purchase?.unit);
  if (!packageUnit || !Number.isFinite(packageAmount) || packageAmount <= 0) {
    return original;
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return original;

  const from = unitInfo(unit);
  const to = unitInfo(packageUnit);

  // Nothing to convert between a teaspoon and a kilo — buy a single package.
  if (!areUnitsCompatible(from, to)) {
    return { amount: packageAmount, unit: packageUnit, rounded: true };
  }

  const converted = convertAmount(numericAmount, from, to);
  const packages = Math.ceil(converted / packageAmount - PACKAGE_EPSILON);

  // A recipe calling for 20+ packages is far more likely to be bad data than a
  // real shopping need, so leave it alone rather than put 25 kg on the list.
  if (packages > MAX_PURCHASE_PACKAGES) {
    console.warn(
      `toPurchaseAmount: ${numericAmount} ${from.unit} is ${packages} x ${packageAmount} ${packageUnit} — leaving the amount unchanged.`,
    );
    return original;
  }

  // Float dust from the unit conversion (0.1 + 0.2 territory) would otherwise
  // reach the UI as "1.5000000000000002 kg".
  const rounded = Math.round(packages * packageAmount * 1000) / 1000;
  return {
    amount: rounded,
    unit: packageUnit,
    rounded: rounded !== numericAmount || packageUnit !== from.unit,
  };
}
