import { describe, it, expect } from "vitest";
import { extractJson, classifyGeminiError } from "./aiJson.js";

describe("extractJson", () => {
  it("parses a clean JSON object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("extracts JSON embedded in surrounding text / markdown fences", () => {
    const raw = 'Itt a recept:\n```json\n{"name":"palacsinta"}\n```';
    expect(extractJson(raw)).toEqual({ name: "palacsinta" });
  });

  it("spans from the first { to the last } (nested objects)", () => {
    expect(extractJson('prefix {"a":{"b":2}} suffix')).toEqual({ a: { b: 2 } });
  });

  it("returns null when there is no JSON object", () => {
    expect(extractJson("nincs itt json")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(extractJson("{not: valid}")).toBeNull();
  });

  it("returns null for empty / nullish input", () => {
    expect(extractJson("")).toBeNull();
    expect(extractJson(null)).toBeNull();
    expect(extractJson(undefined)).toBeNull();
  });
});

describe("classifyGeminiError", () => {
  it("maps a 429 error to status 429 and parses retryDelay", () => {
    const err = new Error('[429] Too Many Requests. "retryDelay":"12s"');
    const result = classifyGeminiError(err);
    expect(result.status).toBe(429);
    expect(result.retryAfterSeconds).toBe(12);
  });

  it("maps a 429 without retryDelay to null retryAfterSeconds", () => {
    const result = classifyGeminiError(new Error("429 rate limited"));
    expect(result.status).toBe(429);
    expect(result.retryAfterSeconds).toBeNull();
  });

  it("maps a 404 error to status 404", () => {
    expect(classifyGeminiError(new Error("[404] model not found")).status).toBe(
      404,
    );
  });

  it("maps an invalid-JSON error to status 502 and keeps raw", () => {
    const err = new Error("Model response was not valid JSON");
    err.raw = "garbage output";
    const result = classifyGeminiError(err);
    expect(result.status).toBe(502);
    expect(result.raw).toBe("garbage output");
  });

  it("returns null for unrecognized errors (caller rethrows original)", () => {
    expect(classifyGeminiError(new Error("network down"))).toBeNull();
    expect(classifyGeminiError({})).toBeNull();
  });
});
