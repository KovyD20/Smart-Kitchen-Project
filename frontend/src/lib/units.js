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
