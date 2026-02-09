const express = require("express");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const router = express.Router();

const filePath = path.join(__dirname, "../data/fridge.json");

function readFridge() {
  return JSON.parse(fs.readFileSync(filePath));
}

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in environment");
  }
  const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });
}

function extractJson(text) {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const jsonText = text.slice(start, end + 1);
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
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
    const message = err?.message || "";
    const retryMatch = message.match(/retryDelay"\s*:\s*"(\d+)s"/i);
    const retryAfterSeconds = retryMatch ? Number(retryMatch[1]) : null;

    if (message.includes("Model response was not valid JSON")) {
      const jsonErr = new Error("AI response was not valid JSON");
      jsonErr.status = 502;
      jsonErr.raw = err.raw;
      throw jsonErr;
    }

    if (message.includes("429")) {
      const quotaErr = new Error("AI quota exceeded");
      quotaErr.status = 429;
      quotaErr.retryAfterSeconds = retryAfterSeconds;
      throw quotaErr;
    }

    if (message.includes("404")) {
      const notFoundErr = new Error("AI model not found");
      notFoundErr.status = 404;
      throw notFoundErr;
    }

    throw err;
  }
}

router.post("/recipe-by-name", async (req, res) => {
  const name = (req.body?.name || "").toString().trim();
  if (!name) {
    return res.status(400).json({ error: "Missing recipe name" });
  }

  const prompt = [
    "Te egy profi séf asszisztens vagy.",
    "Csak magyarul válaszolj. összetevő, mennyiség és elkészítési lépéseket is kizárólag magyarul.",
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

router.post("/suggest-from-fridge", async (req, res) => {
  const fridge = readFridge();
  if (!Array.isArray(fridge) || fridge.length === 0) {
    return res.status(400).json({ error: "Fridge is empty" });
  }

  const items = fridge
    .map((i) => `${i.name} (${i.amount ?? ""} ${i.unit ?? ""})`.trim())
    .join(", ");

  const prompt = [
    "Te egy kreatív séf asszisztens vagy.",
        "Csak magyarul válaszolj. összetevő, mennyiség és elkészítési lépéseket is kizárólag magyarul.",
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

router.post("/recipe-from-fridge", async (req, res) => {
  const name = (req.body?.name || "").toString().trim();
  if (!name) {
    return res.status(400).json({ error: "Missing recipe name" });
  }

  const fridge = readFridge();
  if (!Array.isArray(fridge) || fridge.length === 0) {
    return res.status(400).json({ error: "Fridge is empty" });
  }

  const items = fridge
    .map((i) => `${i.name} (${i.amount ?? ""} ${i.unit ?? ""})`.trim())
    .join(", ");

  const prompt = [
    "Te egy precíz séf asszisztens vagy.",
    "Csak magyarul válaszolj. összetevő, mennyiség és elkészítési lépéseket is kizárólag magyarul.",
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
