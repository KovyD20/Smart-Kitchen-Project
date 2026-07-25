import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createCatalog } from "../constants/pantryCatalog";

const CatalogContext = createContext(null);


export function CatalogProvider({ children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/pantry/catalog");
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
  }, []);

  const value = useMemo(() => {
    const catalog = createCatalog(data || { categories: [] });
    return { ...catalog, ready: Boolean(data), loading, error };
  }, [data, loading, error]);

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
