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

// The SDK passes no timeout to fetch unless one is supplied, so an unanswered
// request is governed by Node's undici default headersTimeout (300s). These are
// thinking models: generateContent holds the socket open with no response headers
// until the whole answer is ready, so a slow or overloaded model silently trips
// that limit and fetch rejects with a bare "fetch failed" -- no HTTP status, and
// the request still shows as received on Google's side. Time out on our own terms
// instead, comfortably under 300s.
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 90000;

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in environment");
  }
  const modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel(
    {
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    },
    { timeout: GEMINI_TIMEOUT_MS },
  );
}

// Capacity fluctuates: the same request intermittently comes back as 503
// UNAVAILABLE ("high demand"), so a single attempt would surface a hard error to
// the user for a transient blip. An overloaded model can also take a minute or
// more just to produce that 503, so retries are bounded by a wall-clock deadline
// as well as an attempt count -- otherwise three slow attempts leave the caller
// hanging for several minutes. Timeouts are retried alongside overload; quota
// (429) and bad requests must still fail fast.
const RETRYABLE =
  /\b503\b|UNAVAILABLE|high demand|overloaded|fetch failed|Request aborted when|\bUND_ERR_\w+/i;

async function generateContentWithRetry(
  model,
  prompt,
  attempts = 3,
  budgetMs = GEMINI_TIMEOUT_MS * 2,
) {
  const deadline = Date.now() + budgetMs;
  for (let attempt = 1; ; attempt++) {
    try {
      return await model.generateContent(prompt);
    } catch (err) {
      const retryable = RETRYABLE.test(err?.message || "");
      if (!retryable || attempt >= attempts || Date.now() >= deadline) throw err;
      await new Promise((resolve) =>
        setTimeout(resolve, 700 * 2 ** (attempt - 1)),
      );
    }
  }
}

async function generateJson(prompt) {
  const model = getModel();
  try {
    const result = await generateContentWithRetry(model, prompt);
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


