const express = require("express");
const { z } = require("zod");
const { requireAuth } = require("../middleware/auth");
const { aiLimiter } = require("../middleware/rateLimit");
const { validate } = require("../middleware/validate");
const { generateJson } = require("../lib/aiClient");
const {
  RECIPE_SCHEMA,
  FRIDGE_RECIPE_SCHEMA,
  OPTIONS_SCHEMA,
  SYSTEM_PROMPT,
} = require("../lib/aiSchemas");

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

function describeItems(items) {
  return items
    .map((item) => `${item.name} (${item.amount ?? ""} ${item.unit ?? ""})`.trim())
    .join(", ");
}

// Every endpoint fails the same way, and the shape of that failure is part of the
// contract with the frontend: `code` selects the Hungarian wording there.
function sendAiError(res, err, endpoint) {
  console.error(`AI error ${endpoint}:`, err.raw || err.message);
  const payload = { error: err.message || "AI generation failed" };
  if (err.code) payload.code = err.code;
  if (err.raw) payload.raw = err.raw;
  if (err.retryAfterSeconds) {
    payload.retry_after_seconds = err.retryAfterSeconds;
  }
  res.status(err.status || 500).json(payload);
}

router.post("/recipe-by-name", validate(recipeByNameSchema), async (req, res) => {
  const { name } = req.body;

  try {
    const recipe = await generateJson({
      system: SYSTEM_PROMPT,
      prompt: `Készíts receptet az alábbi ételnév alapján: "${name}"`,
      schema: RECIPE_SCHEMA,
    });
    res.json({ recipe });
  } catch (err) {
    sendAiError(res, err, "/recipe-by-name");
  }
});

router.post("/suggest-from-fridge", validate(suggestFromFridgeSchema), async (req, res) => {
  const prompt = [
    "Az alábbi elérhető hozzávalók alapján adj 5-8 lehetséges, magyar nevű ételt.",
    `Hozzávalók: ${describeItems(req.body.items)}`,
  ].join("\n");

  try {
    const data = await generateJson({
      system: SYSTEM_PROMPT,
      prompt,
      schema: OPTIONS_SCHEMA,
    });
    res.json({ options: data.options || [] });
  } catch (err) {
    sendAiError(res, err, "/suggest-from-fridge");
  }
});

router.post("/recipe-from-fridge", validate(recipeFromFridgeSchema), async (req, res) => {
  const { name } = req.body;

  const prompt = [
    "Készíts receptet a megadott ételnévhez KIZÁRÓLAG a listázott hozzávalókból.",
    "Ne adj hozzá olyan hozzávalót, ami nincs a listában.",
    'Ha az étel nem készíthető el a listából, a "feasible" mező legyen false, a servings és a time_minutes 0, az ingredients és a steps pedig üres lista.',
    `Étel neve: "${name}"`,
    `Elérhető hozzávalók: ${describeItems(req.body.items)}`,
  ].join("\n");

  try {
    const { feasible, ...recipe } = await generateJson({
      system: SYSTEM_PROMPT,
      prompt,
      schema: FRIDGE_RECIPE_SCHEMA,
    });
    if (!feasible) {
      return res.status(422).json({
        error: "Recipe not possible from these ingredients",
        code: "AI_NOT_FEASIBLE",
      });
    }
    res.json({ recipe });
  } catch (err) {
    sendAiError(res, err, "/recipe-from-fridge");
  }
});

module.exports = router;
