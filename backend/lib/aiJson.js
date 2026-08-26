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

  // Transient overload, distinct from 429: the request was fine and the quota is
  // intact, the model just had no capacity. The route already retries these, so
  // reaching here means the retries were used up — say so instead of "failed".
  if (/\b503\b|UNAVAILABLE|high demand/i.test(message)) {
    const busyErr = new Error("AI temporarily overloaded");
    busyErr.status = 503;
    return busyErr;
  }

  // Network-level failure: the SDK never got an HTTP status back, so it wrapped a
  // raw fetch rejection ("Error fetching from ...: fetch failed") or an abort from
  // requestOptions.timeout. The dominant cause is a thinking model holding the
  // connection open with no headers until Node's undici default headersTimeout
  // (300s) tears the socket down -- the request did reach Google and shows up in
  // the dashboard, but the client hung up before any response arrived. Report it
  // as a gateway timeout so the client can retry instead of showing SDK internals.
  if (
    /fetch failed|Request aborted when|The operation was aborted|terminated/i.test(message) ||
    /\bUND_ERR_\w+/.test(message) ||
    /\b(ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|UND_ERR_HEADERS_TIMEOUT)\b/.test(
      `${message} ${err?.cause?.code || ""} ${err?.code || ""}`,
    )
  ) {
    const timeoutErr = new Error("AI request timed out");
    timeoutErr.status = 504;
    return timeoutErr;
  }

  return null;
}

module.exports = { extractJson, classifyGeminiError };
