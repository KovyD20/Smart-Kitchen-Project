import { describe, it, expect, vi } from "vitest";
import {
  buildCatalogNamePrompt,
  createCatalogNameCache,
} from "./catalogNames.js";

const rows = (...names) => ({
  rows: names.map((name) =>
    typeof name === "string" ? { canonical_name: name, priority: "extra" } : name,
  ),
});

describe("buildCatalogNamePrompt", () => {
  it("names the catalog items and says what to do when one is missing", () => {
    const text = buildCatalogNamePrompt(["vaj", "tej"]);

    expect(text).toContain("vaj, tej");
    expect(text).toContain("pontosan azt a nevet használd");
    // The second half is what keeps an off-catalog ingredient off the nearest
    // catalog row: a made-up name beats a confidently wrong one.
    expect(text).toContain("ne erőltesd rá a listára");
    // Appended to a prompt, so it has to start on a line of its own.
    expect(text.startsWith("\n")).toBe(true);
  });

  it("says nothing at all without names", () => {
    expect(buildCatalogNamePrompt([])).toBe("");
    expect(buildCatalogNamePrompt(null)).toBe("");
    expect(buildCatalogNamePrompt(undefined)).toBe("");
  });
});

describe("catalog name cache", () => {
  it("reads the catalog once and serves the rest from memory", async () => {
    const query = vi.fn().mockResolvedValue(rows("tej", "vaj"));
    const cache = createCatalogNameCache({ query });

    expect((await cache.get()).names).toEqual(["tej", "vaj"]);
    await cache.get();
    await cache.get();

    expect(query).toHaveBeenCalledTimes(1);
  });

  it("goes back to the catalog once the entry is stale", async () => {
    let clock = 1000;
    const query = vi.fn().mockResolvedValue(rows("tej"));
    const cache = createCatalogNameCache({
      query,
      ttlMs: 100,
      now: () => clock,
    });

    await cache.get();
    clock += 99;
    await cache.get();
    expect(query).toHaveBeenCalledTimes(1);

    clock += 2;
    await cache.get();
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("collapses concurrent misses into one query", async () => {
    const query = vi.fn().mockResolvedValue(rows("tej"));
    const cache = createCatalogNameCache({ query });

    const all = await Promise.all([cache.get(), cache.get(), cache.get()]);

    expect(query).toHaveBeenCalledTimes(1);
    for (const value of all) expect(value.names).toEqual(["tej"]);
  });

  // The contract that matters: the names are a hint, so an AI request must not
  // start failing because Render put the database to sleep.
  it("answers with an empty list when the catalog is unreachable", async () => {
    const query = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const cache = createCatalogNameCache({ query });

    await expect(cache.get()).resolves.toEqual({ names: [], preferred: [] });
    await expect(cache.prompt()).resolves.toBe("");
  });

  it("serves the last good answer rather than nothing", async () => {
    let clock = 1000;
    const query = vi
      .fn()
      .mockResolvedValueOnce(rows("tej"))
      .mockRejectedValue(new Error("ECONNREFUSED"));
    const cache = createCatalogNameCache({ query, ttlMs: 10, now: () => clock });

    await cache.get();
    clock += 20;

    // Stale beats empty: the catalog has not changed just because it is asleep.
    expect((await cache.get()).names).toEqual(["tej"]);
  });

  it("retries after a failure instead of caching it", async () => {
    const query = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValue(rows("tej"));
    const cache = createCatalogNameCache({ query });

    expect((await cache.get()).names).toEqual([]);
    expect((await cache.get()).names).toEqual(["tej"]);
  });

  it("skips blank names and keeps the stocked ones apart", async () => {
    const query = vi.fn().mockResolvedValue(
      rows(
        { canonical_name: "vaj", priority: "essential" },
        { canonical_name: "kapribogyó", priority: "extra" },
        { canonical_name: "tej", priority: "good_to_have" },
        { canonical_name: "   ", priority: "extra" },
        { canonical_name: null, priority: "extra" },
      ),
    );
    const cache = createCatalogNameCache({ query });

    const value = await cache.get();
    expect(value.names).toEqual(["vaj", "kapribogyó", "tej"]);
    expect(value.preferred).toEqual(["vaj", "tej"]);

    // The narrowing path the URL endpoint would take if its prompt ever had to
    // shrink -- present and working, though nothing uses it yet.
    expect(await cache.prompt({ preferredOnly: true })).toContain("vaj, tej");
  });

  it("asks the catalog table for the names in a stable order", async () => {
    const query = vi.fn().mockResolvedValue(rows("tej"));
    await createCatalogNameCache({ query }).get();

    const [sql] = query.mock.calls[0];
    expect(sql).toContain("FROM pantry_items");
    expect(sql).toContain("canonical_name");
    expect(sql).toContain("ORDER BY canonical_name");
  });

  it("forgets everything on reset", async () => {
    const query = vi.fn().mockResolvedValue(rows("tej"));
    const cache = createCatalogNameCache({ query });

    await cache.get();
    cache.reset();
    await cache.get();

    expect(query).toHaveBeenCalledTimes(2);
  });
});
