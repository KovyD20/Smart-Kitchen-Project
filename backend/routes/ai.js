const express = require("express");
const { z } = require("zod");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { requireAuth } = require("../middleware/auth");
const { aiLimiter } = require("../middleware/rateLimit");
const { validate } = require("../middleware/validate");
const { extractJson, classifyGeminiError } = require("../lib/aiJson");

const router = express.Router();

// All AI endpoints require an authenticated user, then are rate-limited per user.
router.use(requireAuth);
router.use(aiLimiter);

const itemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  amount: z.union([z.number(), z.string()]).optional(),
  unit: z.string().max(40).optional(),
});

const recipeByNameSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const suggestFromFridgeSchema = z.object({
  items: z.array(itemSchema).min(1),
});

const recipeFromFridgeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  items: z.array(itemSchema).min(1),
});

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

const AI_UNIT_RULES = [
  `A hozzávalók "unit" mezőjében csak ezeket használd: ${AI_ALLOWED_UNITS.join(", ")}.`,
  "Szinonimák normalizálása: teáskanál/kiskanál -> tk, evőkanál -> ek, darab -> db.",
  "Hosszú forma helyett rövidítéseket használj (pl. teáskanál helyett tk).",
].join(" ");

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in environment");
  }
  const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });
}

async function generateJson(prompt) {
  const model = getModel();
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = extractJson(text);
    if (!parsed) {
      const err = new Error("Model response was not valid JSON");
      err.raw = text;
      throw err;
    }
    return parsed;
  } catch (err) {
    const classified = classifyGeminiError(err);
    if (classified) throw classified;
    throw err;
  }
}

router.post("/recipe-by-name", validate(recipeByNameSchema), async (req, res) => {
  const { name } = req.body;

  const prompt = [
    "Te egy profi séf asszisztens vagy.",
    "Csak magyarul válaszolj. összetevő, mennyiség és elkészítési lépéseket is kizárólag magyarul.",
    "Hozzávalóknál először magát a hozzávalót írd, utána pedig a mennyiséget",
    "Kizárólag érvényes JSON-t adj vissza. Ne írj markdown-t, se extra szöveget.",
    "Készíts receptet az alábbi ételnév alapján:",
    `"${name}"`,
    "JSON séma:",
    "{",
    '  "name": "string",',
    '  "servings": number,',
    '  "time_minutes": number,',
    '  "ingredients": [ { "name": "string", "amount": number, "unit": "string" } ],',
    '  "steps": [ "string" ]',
    "}",
    AI_UNIT_RULES,
    "Minden szöveges mezőt magyarul írj.",
  ].join("\n");

  try {
    const recipe = await generateJson(prompt);
    res.json({ recipe });
  } catch (err) {
    console.error("Gemini error /recipe-by-name:", err.raw || err.message);
    const status = err.status || 500;
    const payload = { error: err.message || "AI generation failed" };
    if (err.raw) payload.raw = err.raw;
    if (err.retryAfterSeconds) {
      payload.retry_after_seconds = err.retryAfterSeconds;
    }
    res.status(status).json(payload);
  }
});

router.post("/suggest-from-fridge", validate(suggestFromFridgeSchema), async (req, res) => {
  const fridge = req.body.items;

  const items = fridge
    .map((i) => `${i.name} (${i.amount ?? ""} ${i.unit ?? ""})`.trim())
    .join(", ");

  const prompt = [
    "Te egy kreatív séf asszisztens vagy.",
    "Csak magyarul válaszolj. összetevő, mennyiség és elkészítési lépéseket is kizárólag magyarul.",
    "Hozzávalóknál először magát a hozzávalót írd, utána pedig a mennyiséget",
    "Kizárólag érvényes JSON-t adj vissza. Ne írj markdown-t, se extra szöveget.",
    "Az alábbi elérhető hozzávalók alapján adj 5-8 lehetséges ételnevet.",
    "Magyar neveket használj.",
    `Hozzávalók: ${items}`,
    "JSON séma:",
    '{ "options": [ "string" ] }',
  ].join("\n");

  try {
    const data = await generateJson(prompt);
    res.json({ options: data.options || [] });
  } catch (err) {
    console.error("Gemini error /suggest-from-fridge:", err.raw || err.message);
    const status = err.status || 500;
    const payload = { error: err.message || "AI generation failed" };
    if (err.raw) payload.raw = err.raw;
    if (err.retryAfterSeconds) {
      payload.retry_after_seconds = err.retryAfterSeconds;
    }
    res.status(status).json(payload);
  }
});

router.post("/recipe-from-fridge", validate(recipeFromFridgeSchema), async (req, res) => {
  const { name } = req.body;
  const fridge = req.body.items;

  const items = fridge
    .map((i) => `${i.name} (${i.amount ?? ""} ${i.unit ?? ""})`.trim())
    .join(", ");

  const prompt = [
    "Te egy precíz séf asszisztens vagy.",
    "Csak magyarul válaszolj. összetevő, mennyiség és elkészítési lépéseket is kizárólag magyarul.",
    "Hozzávalóknál először magát a hozzávalót írd, utána pedig a mennyiséget",
    "Kizárólag érvényes JSON-t adj vissza. Ne írj markdown-t, se extra szöveget.",
    "Készíts receptet a megadott ételnévhez KIZÁRÓLAG a listázott hozzávalókból.",
    "Ne adj hozzá olyan hozzávalót, ami nincs a listában.",
    'Ha nem készíthető el, akkor add vissza: { "error": "ok" }.',
    `Étel neve: "${name}"`,
    `Elérhető hozzávalók: ${items}`,
    "JSON séma:",
    "{",
    '  "name": "string",',
    '  "servings": number,',
    '  "time_minutes": number,',
    '  "ingredients": [ { "name": "string", "amount": number, "unit": "string" } ],',
    '  "steps": [ "string" ]',
    "}",
    AI_UNIT_RULES,
    "Minden szöveges mezőt magyarul írj.",
  ].join("\n");

  try {
    const recipe = await generateJson(prompt);
    if (recipe.error) {
      return res.status(422).json({ error: recipe.error });
    }
    res.json({ recipe });
  } catch (err) {
    console.error("Gemini error /recipe-from-fridge:", err.raw || err.message);
    const status = err.status || 500;
    const payload = { error: err.message || "AI generation failed" };
    if (err.raw) payload.raw = err.raw;
    if (err.retryAfterSeconds) {
      payload.retry_after_seconds = err.retryAfterSeconds;
    }
    res.status(status).json(payload);
  }
});

module.exports = router;


