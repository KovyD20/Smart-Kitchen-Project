// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { isPlainKey, isTypingTarget } from "./keyboard";

const el = (html) => {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host.firstElementChild;
};

describe("isTypingTarget", () => {
  it("is true for the fields a shortcut must not interrupt", () => {
    expect(isTypingTarget(el("<input />"))).toBe(true);
    expect(isTypingTarget(el('<input type="number" />'))).toBe(true);
    expect(isTypingTarget(el('<input type="search" />'))).toBe(true);
    expect(isTypingTarget(el("<textarea></textarea>"))).toBe(true);
    expect(isTypingTarget(el("<select></select>"))).toBe(true);
    expect(isTypingTarget(el('<div contenteditable="true"></div>'))).toBe(true);
  });

  it("is false for inputs that are really buttons", () => {
    expect(isTypingTarget(el('<input type="checkbox" />'))).toBe(false);
    expect(isTypingTarget(el('<input type="radio" />'))).toBe(false);
    expect(isTypingTarget(el('<input type="file" />'))).toBe(false);
  });

  it("is false for ordinary elements", () => {
    expect(isTypingTarget(el("<button></button>"))).toBe(false);
    expect(isTypingTarget(el("<div></div>"))).toBe(false);
  });

  it("accepts an event and reads its target", () => {
    expect(isTypingTarget({ target: el("<input />") })).toBe(true);
    expect(isTypingTarget({ target: el("<button></button>") })).toBe(false);
  });

  it("survives a missing target", () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget({ target: null })).toBe(false);
  });
});

describe("isPlainKey", () => {
  it("allows Shift, so '?' stays a shortcut", () => {
    expect(isPlainKey({ shiftKey: true })).toBe(true);
  });

  it("rejects the modifiers that make a browser or OS shortcut", () => {
    expect(isPlainKey({ ctrlKey: true })).toBe(false);
    expect(isPlainKey({ metaKey: true })).toBe(false);
    expect(isPlainKey({ altKey: true })).toBe(false);
  });
});
