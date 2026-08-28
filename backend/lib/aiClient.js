// The single place that knows which AI provider and SDK we talk to. Routes build
// prompts and schemas; everything below the `generateJson()` line is provider
// detail. Flash model generations are retired roughly twice a year and the
// shutdown is hard, so keeping that knowledge in one file is what makes the next
// migration an env change plus one module, rather than an AI-layer rewrite.
const { GoogleGenAI, Type } = require("@google/genai");
const { classifyAiError } = require("./aiError");

// Verified working on the free tier; see IMPROVE_TERV.md 1.2 for the measurements
// behind this choice. Overridable so a model swap never needs a code change --
// but do re-check the model list about every six months.
const DEFAULT_MODEL = "gemini-3.6-flash";

// These are thinking models: the socket stays open with no response headers until
// the whole answer is ready, so a slow or overloaded model would otherwise trip
// Node's undici default headersTimeout (300s) and reject with a bare "fetch
// failed" -- no HTTP status, while the request still counts on the provider's
// side. Time out on our own terms, comfortably under that.
const REQUEST_TIMEOUT_MS =
  Number(process.env.AI_TIMEOUT_MS || process.env.GEMINI_TIMEOUT_MS) || 90000;

// Capacity fluctuates: the same request intermittently comes back as 503
// UNAVAILABLE ("high demand"), so a single attempt would surface a hard error for
// a transient blip. 429 is deliberately absent from the retryable set -- the free
// tier's quota is daily, and retrying it just burns the remainder faster.
const RETRY_STATUS_CODES = [408, 500, 502, 503, 504];

// A network-level failure never reaches the SDK's status-based retry, so allow
// one extra attempt here. Bounded by a wall-clock deadline as well as a count:
// two timed-out attempts must not leave the caller hanging for several minutes.
const NETWORK_RETRY_ATTEMPTS = 2;
const RETRY_BUDGET_MS = REQUEST_TIMEOUT_MS * 2;
const RETRYABLE_NETWORK_FAILURE =
  /fetch failed|terminated|ECONNRESET|EAI_AGAIN|\bUND_ERR_\w+/i;

let cached = null;

function getModelName() {
  return process.env.AI_MODEL || DEFAULT_MODEL;
}

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in environment");
  }
  // Keyed on the key so tests (and a rotated secret) get a fresh client instead
  // of a stale one built at first call.
  if (!cached || cached.apiKey !== apiKey) {
    cached = {
      apiKey,
      client: new GoogleGenAI({
        apiKey,
        httpOptions: {
          timeout: REQUEST_TIMEOUT_MS,
          retryOptions: {
            attempts: 3,
            initialDelay: 0.7,
            expBase: 2,
            httpStatusCodes: RETRY_STATUS_CODES,
          },
        },
      }),
    };
  }
  return cached.client;
}

async function callModel(request) {
  const deadline = Date.now() + RETRY_BUDGET_MS;
  for (let attempt = 1; ; attempt++) {
    try {
      return await getClient().models.generateContent(request);
    } catch (err) {
      const retryable = RETRYABLE_NETWORK_FAILURE.test(err?.message || "");
      if (
        !retryable ||
        attempt >= NETWORK_RETRY_ATTEMPTS ||
        Date.now() >= deadline
      ) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }
}

// Asks the model for JSON matching `schema` and returns it parsed.
//
// `schema` is enforced by the provider (structured output), not merely requested
// in the prompt -- so no markdown fences, no prose wrapper, and enum fields such
// as the allowed units are guaranteed rather than hoped for.
async function generateJson({
  system,
  prompt,
  schema,
  maxTokens = 4096,
  temperature = 0.2,
}) {
  try {
    const response = await callModel({
      model: getModelName(),
      contents: prompt,
      config: {
        systemInstruction: system,
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const text = response.text;
    try {
      return JSON.parse(text);
    } catch {
      // With a response schema this should be unreachable; in practice it still
      // happens when the answer is cut off at maxOutputTokens mid-object.
      const err = new Error("Model response was not valid JSON");
      err.code = "AI_INVALID_JSON";
      err.raw = text;
      throw err;
    }
  } catch (err) {
    const classified = classifyAiError(err);
    if (classified) throw classified;
    throw err;
  }
}

module.exports = { generateJson, getModelName, Type };
