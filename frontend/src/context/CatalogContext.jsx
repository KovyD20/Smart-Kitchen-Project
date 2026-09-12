import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createCatalog } from "../constants/pantryCatalog";
import { apiUrl } from "../lib/api";

const CatalogContext = createContext(null);

// Where the previous catalog response is kept. The `v1` versions the *shape* of
// the payload, not the data in it: bump it when the API's JSON changes in a way
// createCatalog would misread, so stale entries are ignored instead of parsed.
const CACHE_KEY = "smartkitchen.pantryCatalog.v1";

// Both cache helpers swallow everything they can throw. In a private window even
// touching window.localStorage raises, and the cache is an optimisation — losing
// it may cost a fetch, never the app.
function readCachedCatalog() {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // A truncated or hand-edited entry counts as no cache at all: only the shape
    // createCatalog can actually group by is accepted.
    return Array.isArray(parsed?.categories) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedCatalog(json) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(json));
  } catch {
    // A full or blocked store only costs the next visit its head start.
  }
}

// Stale-while-revalidate around the pantry catalog.
//
// The catalog comes from the Render backend, which sleeps after 15 minutes of
// inactivity and takes 30-60s to wake. Without a cache that whole wait runs with
// `ready: false`, so every row lands in "Egyéb" and then jumps into its real
// category once the fetch arrives. Reading the previous response synchronously,
// before the first render, makes that first paint the correct one; the request
// behind it is a refresh rather than the thing being waited on.
export function CatalogProvider({ children }) {
  // Lazy initialiser: the cache is read once, on mount, and the same value seeds
  // both pieces of state below.
  const [cached] = useState(readCachedCatalog);
  const [data, setData] = useState(cached);
  // "Nothing to show and a request in flight". With a cache there is something
  // to show from the first frame, so the revalidate must not raise the banner.
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  // Bumping this re-runs the fetch effect. The free Render backend sleeps after
  // 15 minutes of inactivity and takes 30-60s to wake, so the first load can
  // legitimately fail and be worth retrying by hand.
  const [attempt, setAttempt] = useState(0);

  // Whether anything is on screen, readable inside the effect without listing
  // `data` as a dependency — which would refetch every time a response lands.
  const hasCatalog = useRef(Boolean(cached));

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // A retry after a failure has to clear the previous error, or the banner
      // would keep showing the old message while the new request is in flight.
      setError(null);
      if (!hasCatalog.current) setLoading(true);
      try {
        const res = await fetch(apiUrl("/api/pantry/catalog"));
        if (!res.ok) throw new Error(`Catalog fetch failed (${res.status})`);
        const json = await res.json();
        // Cached before the cancellation check: the payload is good regardless
        // of whether this particular mount is still around to render it (React
        // StrictMode discards the first pass in development).
        writeCachedCatalog(json);
        if (cancelled) return;
        hasCatalog.current = true;
        setData(json);
      } catch (err) {
        // With a catalog already on screen a failed refresh is not the user's
        // problem: the cached copy stays and no error banner covers it.
        if (!cancelled && !hasCatalog.current) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const value = useMemo(() => {
    const catalog = createCatalog(data || { categories: [] });
    return { ...catalog, ready: Boolean(data), loading, error, reload };
  }, [data, loading, error, reload]);

  return (
    <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
  );
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) {
    throw new Error("useCatalog must be used within a CatalogProvider");
  }
  return ctx;
}
