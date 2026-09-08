import { describe, it, expect } from "vitest";
import { parseSeedArgs, describeTarget } from "./seedOptions.js";

// The point of these tests is one invariant: nothing but an explicit `--reset`
// may put the seed on the truncating path. Everything else is a rounding error
// next to accidentally wiping the catalog.
describe("parseSeedArgs", () => {
  it("defaults to the additive path with no arguments", () => {
    expect(parseSeedArgs([])).toEqual({ reset: false });
    expect(parseSeedArgs()).toEqual({ reset: false });
  });

  it("opts into reset only for the exact --reset flag", () => {
    expect(parseSeedArgs(["--reset"]).reset).toBe(true);
    expect(parseSeedArgs(["--other", "--reset"]).reset).toBe(true);
  });

  it("does not reset on near misses", () => {
    // A typo must never be read as consent to truncate.
    for (const argv of [
      ["reset"],
      ["-reset"],
      ["--Reset"],
      ["--reset-catalog"],
      ["--no-reset"],
      ["--truncate"],
      [""],
    ]) {
      expect(parseSeedArgs(argv).reset, argv.join(" ")).toBe(false);
    }
  });

  it("tolerates a non-array argv instead of throwing", () => {
    expect(parseSeedArgs(null).reset).toBe(false);
    expect(parseSeedArgs("--reset").reset).toBe(false);
  });
});

describe("describeTarget", () => {
  it("names host, port and database", () => {
    expect(
      describeTarget({ DB_HOST: "db.example", DB_PORT: "6543", DB_NAME: "sk" }),
    ).toBe("db.example:6543/sk");
  });

  it("marks TLS, which is what a managed instance looks like", () => {
    expect(
      describeTarget({
        DB_HOST: "ep-x.neon.tech",
        DB_NAME: "neondb",
        DB_SSL: "true",
      }),
    ).toBe("ep-x.neon.tech:5432/neondb ssl");
  });

  it("falls back to the local defaults and flags a missing database name", () => {
    expect(describeTarget({})).toBe("localhost:5432/(unset)");
  });

  it("never includes credentials", () => {
    const target = describeTarget({
      DB_HOST: "h",
      DB_NAME: "n",
      DB_USER: "seed_user",
      DB_PASSWORD: "s3cret",
    });
    expect(target).not.toContain("s3cret");
    expect(target).not.toContain("seed_user");
  });
});
