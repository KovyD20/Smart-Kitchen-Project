import { describe, it, expect } from "vitest";
import { aiErrorMessage } from "./aiErrors.js";

describe("aiErrorMessage", () => {
  it("tells the user to come back tomorrow when the daily quota is gone", () => {
    const message = aiErrorMessage(429, {
      error: "AI quota exceeded",
      code: "AI_QUOTA",
    });
    expect(message).toMatch(/napi/i);
    expect(message).toMatch(/holnap/i);
  });

  it("tells the user to wait when the quota hint is a short retry delay", () => {
    const message = aiErrorMessage(429, {
      error: "AI quota exceeded",
      code: "AI_QUOTA",
      retry_after_seconds: 31,
    });
    expect(message).toMatch(/percenkénti/i);
    expect(message).toContain("31");
  });

  it("treats a long retry hint as the daily cap, not a short wait", () => {
    const message = aiErrorMessage(429, {
      code: "AI_QUOTA",
      retry_after_seconds: 3600,
    });
    expect(message).toMatch(/holnap/i);
  });

  it("separates our own per-user limiter from the provider quota", () => {
    const message = aiErrorMessage(429, {
      error: "Too many AI requests, please try again later",
    });
    expect(message).toMatch(/túl sok ai kérés/i);
  });

  it("says a retired model is not the user's problem to retry", () => {
    const message = aiErrorMessage(404, { code: "AI_MODEL_NOT_FOUND" });
    expect(message).toMatch(/fejlesztő/i);
  });

  it("explains an infeasible fridge recipe instead of showing 'ok'", () => {
    // The old backend answered { error: "ok" }, which reached the user verbatim.
    const message = aiErrorMessage(422, {
      error: "Recipe not possible from these ingredients",
      code: "AI_NOT_FEASIBLE",
    });
    expect(message).toMatch(/nem készíthető el/i);
    expect(message).not.toBe("ok");
  });

  it("keeps the empty-fridge wording", () => {
    expect(aiErrorMessage(400, { error: "Fridge is empty" })).toBe("A hűtő üres");
  });

  it("falls back to the server message, then to a generic line", () => {
    expect(aiErrorMessage(500, { error: "Something odd" })).toBe("Something odd");
    expect(aiErrorMessage(500, {})).toBe("AI hiba");
    expect(aiErrorMessage(500, null)).toBe("AI hiba");
  });

  it("maps every known code to a non-empty Hungarian message", () => {
    for (const code of [
      "AI_QUOTA",
      "AI_MODEL_NOT_FOUND",
      "AI_AUTH",
      "AI_OVERLOADED",
      "AI_TIMEOUT",
      "AI_INVALID_JSON",
      "AI_BAD_REQUEST",
      "AI_NOT_FEASIBLE",
    ]) {
      const message = aiErrorMessage(500, { code });
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toBe("AI hiba");
    }
  });
});
