// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";

// The real module reaches ../firebase for authedFetch, which this context never
// uses -- the catalog endpoint is public.
vi.mock("../lib/api", () => ({ apiUrl: (path) => `http://api.test${path}` }));

const { CatalogProvider, useCatalog } = await import("./CatalogContext");

const CACHE_KEY = "smartkitchen.pantryCatalog.v1";

// The API's shape, cut down to the fields createCatalog reads.
const payload = (canonicalName) => ({
  categories: [
    {
      name: "Tejtermékek, tojás",
      sortOrder: 1,
      items: [
        {
          canonicalName,
          normalizedKey: canonicalName,
          aliases: [],
          priority: "essential",
          purchase: { unit: "l", amount: 1 },
        },
      ],
    },
  ],
});

const CACHED = payload("tej");
const FRESH = payload("vaj");

// A fetch that stays pending, for asserting what the very first render shows:
// with a cache that has to be the cached catalog, not a loading state.
const neverResolves = () => new Promise(() => {});

const respondWith = (json) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(json) });

const render = () =>
  renderHook(() => useCatalog(), { wrapper: CatalogProvider });

// The catalog's own item list, which is what a cache hit has to make available.
const names = (result) => result.current.CATALOG_ITEMS.map((item) => item.name);

const readCache = () => JSON.parse(window.localStorage.getItem(CACHE_KEY));

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
afterEach(cleanup);

describe("CatalogProvider without a cache", () => {
  it("waits on the fetch, with nothing to show meanwhile", async () => {
    vi.stubGlobal("fetch", vi.fn(neverResolves));
    const { result } = render();

    expect(result.current.ready).toBe(false);
    expect(result.current.loading).toBe(true);
    expect(names(result)).toEqual([]);
  });

  it("stores the response it just rendered", async () => {
    vi.stubGlobal("fetch", vi.fn(() => respondWith(FRESH)));
    const { result } = render();

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(names(result)).toEqual(["vaj"]);
    expect(readCache()).toEqual(FRESH);
  });

  it("surfaces a failure, because there is nothing else to show", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    const { result } = render();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.ready).toBe(false);
    expect(window.localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it("treats a rejected status as a failure and caches nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 503 })));
    const { result } = render();

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(window.localStorage.getItem(CACHE_KEY)).toBeNull();
  });
});

describe("CatalogProvider with a cache", () => {
  beforeEach(() => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(CACHED));
  });

  it("is ready on the first render, before the fetch answers", () => {
    vi.stubGlobal("fetch", vi.fn(neverResolves));
    const { result } = render();

    // The whole point: no "Egyéb" phase while Render wakes up.
    expect(result.current.ready).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(names(result)).toEqual(["tej"]);
  });

  it("replaces both the view and the cache once the fetch lands", async () => {
    vi.stubGlobal("fetch", vi.fn(() => respondWith(FRESH)));
    const { result } = render();

    expect(names(result)).toEqual(["tej"]);

    await waitFor(() => expect(names(result)).toEqual(["vaj"]));
    expect(readCache()).toEqual(FRESH);
  });

  it("keeps the cached catalog and stays quiet when the refresh fails", async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error("offline")));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = render();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // No blocking error state: the list on screen is still usable, so the
    // banner has nothing to report.
    expect(result.current.error).toBeNull();
    expect(result.current.ready).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(names(result)).toEqual(["tej"]);
    expect(readCache()).toEqual(CACHED);
  });

  it("ignores an entry that is not a catalog payload", async () => {
    window.localStorage.setItem(CACHE_KEY, '{"categories":');
    vi.stubGlobal("fetch", vi.fn(neverResolves));

    const { result } = render();

    expect(result.current.ready).toBe(false);
    expect(result.current.loading).toBe(true);
  });

  it("ignores an entry of the wrong shape", () => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ items: [] }));
    vi.stubGlobal("fetch", vi.fn(neverResolves));

    const { result } = render();

    expect(result.current.ready).toBe(false);
  });
});

describe("CatalogProvider when localStorage is unavailable", () => {
  // A private window can throw on the property access itself, not just on the
  // read -- which is why every access sits in a try/catch.
  const breakStorage = () => {
    for (const method of ["getItem", "setItem"]) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error("access denied");
      });
    }
  };

  it("behaves exactly like a first visit", async () => {
    breakStorage();
    vi.stubGlobal("fetch", vi.fn(() => respondWith(FRESH)));

    const { result } = render();
    expect(result.current.ready).toBe(false);
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(names(result)).toEqual(["vaj"]);
    expect(result.current.error).toBeNull();
  });
});

describe("CatalogProvider reload", () => {
  it("retries after a failure and clears the error", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(new Error("offline")))
      .mockImplementationOnce(() => respondWith(FRESH));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = render();
    await waitFor(() => expect(result.current.error).toBeTruthy());

    result.current.reload();

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.error).toBeNull();
    expect(names(result)).toEqual(["vaj"]);
  });
});
