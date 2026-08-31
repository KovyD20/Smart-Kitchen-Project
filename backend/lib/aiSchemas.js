// The response schemas and the shared system prompt for the AI recipe endpoints.
//
// These are enforced by the provider (structured output), which is why the route
// prompts carry no JSON formatting rules and no hand-written schema listing. The
// biggest win is `unit`: an enum here means the model *cannot* answer
// "teáskanál", where previously that was only asked for in prose.
// `Type` comes via aiClient so the SDK import stays in one place.
const { Type } = require("./aiClient");

const AI_ALLOWED_UNITS = [
  "db",
  "g",
  "dkg",
  "kg",
  "ml",
  "dl",
  "l",
  "tk",
  "ek",
  "csipet",
  "csokor",
  "gerezd",
  "szelet",
  "bögre",
  "pohár",
  "csomag",
  "konzerv",
  "fej",
  "szál",
  "marék",
];

const INGREDIENTS_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      amount: { type: Type.NUMBER },
      unit: { type: Type.STRING, enum: AI_ALLOWED_UNITS },
      // Optional on purpose: most recipes have neither, and forcing them into
      // `required` would make the model invent section names and remarks.
      group: { type: Type.STRING },
      note: { type: Type.STRING },
    },
    required: ["name", "amount", "unit"],
  },
};

const RECIPE_PROPERTIES = {
  name: { type: Type.STRING },
  servings: { type: Type.INTEGER },
  time_minutes: { type: Type.INTEGER },
  ingredients: INGREDIENTS_SCHEMA,
  steps: { type: Type.ARRAY, items: { type: Type.STRING } },
};

const RECIPE_REQUIRED = [
  "name",
  "servings",
  "time_minutes",
  "ingredients",
  "steps",
];

const RECIPE_SCHEMA = {
  type: Type.OBJECT,
  properties: RECIPE_PROPERTIES,
  required: RECIPE_REQUIRED,
};

// "Can't be made from these ingredients" has to be a field, not a magic payload:
// the old convention returned { "error": "ok" }, which a schema cannot express and
// which reached the user as the literal word "ok".
const FRIDGE_RECIPE_SCHEMA = {
  type: Type.OBJECT,
  properties: { feasible: { type: Type.BOOLEAN }, ...RECIPE_PROPERTIES },
  required: ["feasible", ...RECIPE_REQUIRED],
};

const OPTIONS_SCHEMA = {
  type: Type.OBJECT,
  properties: { options: { type: Type.ARRAY, items: { type: Type.STRING } } },
  required: ["options"],
};

// The language rule used to be repeated near-verbatim in all three prompts; it
// describes the assistant, not the individual request.
const SYSTEM_PROMPT = [
  "Te egy profi séf asszisztens vagy.",
  "Minden szöveges mezőt kizárólag magyarul írj: az étel nevét, a hozzávalókat és az elkészítési lépéseket is.",
  "A hozzávalóknál a name mezőbe csak magát a hozzávalót írd, a mennyiség az amount és a unit mezőbe kerül.",
  "Szinonimák normalizálása: teáskanál/kiskanál -> tk, evőkanál -> ek, darab -> db.",
  'Ha a recept a hozzávalókat szekciókra bontja (pl. tészta és töltelék), minden hozzávaló group mezőjébe írd a szekció nevét (pl. "A töltelékhez"); egyébként hagyd üresen.',
  'A note mezőbe csak az adott hozzávalóra vonatkozó előkészítési megjegyzés kerülhet (pl. "reszelve a héja"); ha nincs ilyen, hagyd üresen.',
].join("\n");

module.exports = {
  AI_ALLOWED_UNITS,
  RECIPE_SCHEMA,
  FRIDGE_RECIPE_SCHEMA,
  OPTIONS_SCHEMA,
  SYSTEM_PROMPT,
};
