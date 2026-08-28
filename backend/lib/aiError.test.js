import { describe, it, expect } from "vitest";
import { classifyAiError } from "./aiError.js";

// The SDK reports HTTP failures as an ApiError: a numeric `status` plus the
// stringified response body as the message. These helpers mirror that shape --
// classification must key on the status, never on the wording.
function apiError(status, body) {
  const err = new Error(JSON.stringify(body ?? { error: { code: status } }));
  err.status = status;
  return err;
}

function quotaBody(retryDelay) {
  return {
    error: {
      code: 429,
      status: "RESOURCE_EXHAUSTED",
      message: "You exceeded your current quota.",
      details: [
        { "@type": "type.googleapis.com/google.rpc.QuotaFailure" },
        { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay },
      ],
    },
  };
}

describe("classifyAiError", () => {
  it("maps 429 to status 429 with the AI_QUOTA code", () => {
    const result = classifyAiError(apiError(429, quotaBody("12s")));
    expect(result.status).toBe(429);
    expect(result.code).toBe("AI_QUOTA");
  });

  it("reads retryDelay out of the nested error details", () => {
    expect(
      classifyAiError(apiError(429, quotaBody("31s"))).retryAfterSeconds,
    ).toBe(31);
  });

  it("rounds a fractional retryDelay up to whole seconds", () => {
    expect(
      classifyAiError(apiError(429, quotaBody("7.2s"))).retryAfterSeconds,
    ).toBe(8);
  });

  it("leaves retryAfterSeconds null when the body carries no retry hint", () => {
    expect(classifyAiError(apiError(429)).retryAfterSeconds).toBeNull();
  });

  it("survives a 429 whose message is not JSON at all", () => {
    const err = new Error("Too Many Requests");
    err.status = 429;
    const result = classifyAiError(err);
    expect(result.status).toBe(429);
    expect(result.retryAfterSeconds).toBeNull();
  });

  it("maps 404 to its own code -- a retired model is the likeliest outage", () => {
    const result = classifyAiError(apiError(404));
    expect(result.status).toBe(404);
    expect(result.code).toBe("AI_MODEL_NOT_FOUND");
  });

  it("does not classify on wording: a 500 mentioning 429 stays a 5xx", () => {
    const err = new Error("internal error while enforcing 429 quota policy");
    err.status = 500;
    expect(classifyAiError(err).status).toBe(503);
  });

  it("hides a rejected API key behind a 500, never a 401", () => {
    // Surfacing 401 would look to the frontend like an expired Firebase token.
    for (const status of [401, 403]) {
      const result = classifyAiError(apiError(status));
      expect(result.status).toBe(500);
      expect(result.code).toBe("AI_AUTH");
    }
  });

  it("maps other 4xx to a 502 bad-request code", () => {
    const result = classifyAiError(apiError(400));
    expect(result.status).toBe(502);
    expect(result.code).toBe("AI_BAD_REQUEST");
  });

  it("maps 5xx overload to 503, distinct from the quota branch", () => {
    const result = classifyAiError(apiError(503));
    expect(result.status).toBe(503);
    expect(result.code).toBe("AI_OVERLOADED");
  });

  it("maps an upstream 408 to a gateway timeout", () => {
    expect(classifyAiError(apiError(408)).status).toBe(504);
  });

  it("maps an invalid-JSON response to 502 and keeps the raw text", () => {
    const err = new Error("Model response was not valid JSON");
    err.code = "AI_INVALID_JSON";
    err.raw = "garbage output";
    const result = classifyAiError(err);
    expect(result.status).toBe(502);
    expect(result.raw).toBe("garbage output");
  });

  it("maps a bare fetch failure to 504, not a generic 500", () => {
    // What a thinking model produces when it holds the socket open with no
    // headers until undici's default headersTimeout kills it: no HTTP status.
    const result = classifyAiError(new Error("fetch failed"));
    expect(result.status).toBe(504);
    expect(result.code).toBe("AI_TIMEOUT");
  });

  it("maps an aborted request (our own timeout) to 504", () => {
    expect(
      classifyAiError(new Error("The operation was aborted.")).status,
    ).toBe(504);
  });

  it("maps an undici socket error carried on err.cause to 504", () => {
    const err = new Error("fetch failed");
    err.cause = { code: "UND_ERR_HEADERS_TIMEOUT" };
    expect(classifyAiError(err).status).toBe(504);
  });

  it("maps a reset connection to 504", () => {
    const err = new Error("request to the model failed");
    err.code = "ECONNRESET";
    expect(classifyAiError(err).status).toBe(504);
  });

  it("returns null for unrecognized errors so the caller rethrows", () => {
    expect(classifyAiError(new Error("something else entirely"))).toBeNull();
    expect(classifyAiError({})).toBeNull();
    expect(classifyAiError(null)).toBeNull();
  });
});
