// Maps a failure from the AI provider onto a client-facing error with an HTTP
// status, so routes never leak SDK internals.
//
// Status-driven on purpose: `@google/genai` throws an `ApiError` carrying a
// numeric `status`, which is the reliable signal. The previous implementation
// matched on `message.includes("429")`, which silently stops working the moment
// the provider rewords its errors.

// The SDK builds `message` as JSON.stringify(errorBody) (the streaming path
// prefixes it with "got status: ..."), so the response body is recoverable
// even though `ApiError` exposes no headers -- which is also why the retry hint
// comes from the body's `retryDelay` rather than the `retry-after` header.
function parseErrorBody(message) {
  if (!message) return null;
  const start = message.indexOf("{");
  const end = message.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(message.slice(start, end + 1));
  } catch {
    return null;
  }
}

// `retryDelay` sits inside error.details[], whose shape varies by error type,
// so walk the parsed body instead of assuming a path.
function findRetryDelaySeconds(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.retryDelay === "string") {
    const match = value.retryDelay.match(/^(\d+(?:\.\d+)?)s$/);
    if (match) return Math.ceil(Number(match[1]));
  }
  for (const child of Object.values(value)) {
    const found = findRetryDelaySeconds(child);
    if (found !== null) return found;
  }
  return null;
}

// Which limit was actually hit. The retry hint alone is a trap: on the free
// tier's *daily* quota the provider still answers "please retry in 14s", and a
// caller that believes it sends the user round a loop that cannot succeed until
// tomorrow -- 15s, then 55s, then 14s again, with no recipe ever arriving.
//
// The violation's quotaId is the honest signal. It reads like
// "GenerateRequestsPerDayPerProjectPerModel-FreeTier", and the "PerDay" in the
// middle is the part that matters; anything else (per minute, per-minute tokens)
// really does clear in about a minute. Walked recursively for the same reason as
// the retry delay: details[] varies in shape by error type.
function findQuotaId(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.quotaId === "string") return value.quotaId;
  for (const child of Object.values(value)) {
    const found = findQuotaId(child);
    if (found !== null) return found;
  }
  return null;
}

// Network-level failure: no HTTP status was ever received, so the SDK wrapped a
// raw fetch rejection or an abort from the request timeout. The dominant cause
// is a thinking model holding the connection open with no response headers until
// the client-side timeout tears the socket down -- the request did reach the
// provider and shows up in its dashboard, but nothing came back.
const NETWORK_FAILURE =
  /fetch failed|Request aborted when|The operation was aborted|aborted|terminated|\bUND_ERR_\w+/i;
const NETWORK_CODE =
  /\b(ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|UND_ERR_HEADERS_TIMEOUT)\b/;

function aiError(message, status, code, extra = {}) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  Object.assign(err, extra);
  return err;
}

// Returns a new Error to throw, or null when the failure isn't recognized (the
// caller should rethrow the original so it surfaces as a plain 500).
//
// The `code` is the stable contract with the frontend: user-facing wording lives
// there (in Hungarian), so it can change without touching this module.
function classifyAiError(err) {
  const message = err?.message || "";

  if (err?.code === "AI_INVALID_JSON") {
    return aiError("AI response was not valid JSON", 502, "AI_INVALID_JSON", {
      raw: err.raw,
    });
  }

  const status = Number(err?.status);
  if (Number.isFinite(status) && status >= 400) {
    if (status === 429) {
      // Quota is billed per project, not per user, so this hits everyone at once.
      // Deliberately not retried anywhere: on a daily quota, retrying only burns
      // through the remainder faster.
      const body = parseErrorBody(message);
      const quotaId = findQuotaId(body);
      return aiError("AI quota exceeded", 429, "AI_QUOTA", {
        retryAfterSeconds: findRetryDelaySeconds(body),
        // Only ever set to "daily", never guessed: without a quotaId the caller
        // is no worse off than before and falls back to reading the hint.
        quotaScope: /PerDay/i.test(quotaId || "") ? "daily" : null,
      });
    }

    if (status === 404) {
      // The most common outage by far: flash generations are retired hard, and a
      // pinned model id simply stops existing. Keep it distinguishable.
      return aiError(
        "AI model not found or retired",
        404,
        "AI_MODEL_NOT_FOUND",
      );
    }

    if (status === 401 || status === 403) {
      // Our API key, not the caller's session. Reporting 401 upstream would look
      // like an expired Firebase token and could bounce the user to the login screen.
      return aiError("AI credentials rejected", 500, "AI_AUTH");
    }

    if (status === 408 || status === 504) {
      return aiError("AI request timed out", 504, "AI_TIMEOUT");
    }

    if (status >= 500) {
      // Transient overload, distinct from 429: the request was fine and the quota
      // is intact, the provider just had no capacity. Retries are already spent
      // by the time this is reached.
      return aiError("AI temporarily overloaded", 503, "AI_OVERLOADED");
    }

    // Any other 4xx means the provider rejected the request we built.
    return aiError("AI request rejected", 502, "AI_BAD_REQUEST");
  }

  if (
    NETWORK_FAILURE.test(message) ||
    NETWORK_CODE.test(`${message} ${err?.cause?.code || ""} ${err?.code || ""}`)
  ) {
    return aiError("AI request timed out", 504, "AI_TIMEOUT");
  }

  return null;
}

module.exports = { classifyAiError };
