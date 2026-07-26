// Pure helpers for handling Gemini responses, extracted from routes/ai.js so they
// can be unit-tested without calling the model.

// Extracts the first JSON object from a model response (models sometimes wrap JSON
// in prose or markdown fences). Returns the parsed object, or null if none/invalid.
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

// Maps a raw Gemini/SDK error to a client-facing error with an HTTP status.
// Returns a new Error (to throw), or null when the error isn't recognized
// (caller should rethrow the original).
function classifyGeminiError(err) {
  const message = err?.message || "";
  const retryMatch = message.match(/retryDelay"\s*:\s*"(\d+)s"/i);
  const retryAfterSeconds = retryMatch ? Number(retryMatch[1]) : null;

  if (message.includes("Model response was not valid JSON")) {
    const jsonErr = new Error("AI response was not valid JSON");
    jsonErr.status = 502;
    jsonErr.raw = err.raw;
    return jsonErr;
  }

  if (message.includes("429")) {
    const quotaErr = new Error("AI quota exceeded");
    quotaErr.status = 429;
    quotaErr.retryAfterSeconds = retryAfterSeconds;
    return quotaErr;
  }

  if (message.includes("404")) {
    const notFoundErr = new Error("AI model not found");
    notFoundErr.status = 404;
    return notFoundErr;
  }

  return null;
}

module.exports = { extractJson, classifyGeminiError };
