import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createCatalog } from "../constants/pantryCatalog";
import { apiUrl } from "../lib/api";

const CatalogContext = createContext(null);

export function CatalogProvider({ children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Bumping this re-runs the fetch effect. The free Render backend sleeps after
  // 15 minutes of inactivity and takes 30-60s to wake, so the first load can
  // legitimately fail and be worth retrying by hand.
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // A retry after a failure has to clear the previous error, or the banner
      // would keep showing the old message while the new request is in flight.
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(apiUrl("/api/pantry/catalog"));
        if (!res.ok) throw new Error(`Catalog fetch failed (${res.status})`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err);
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
