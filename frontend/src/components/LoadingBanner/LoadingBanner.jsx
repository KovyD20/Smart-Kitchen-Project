import { useEffect, useState } from "react";
import Icon from "../Icon/Icon";
import "./LoadingBanner.css";

// How long a load may run before we stop implying it is nearly done and explain
// what is actually happening (the free Render backend waking from sleep).
const SLOW_AFTER_MS = 5000;

// Split out so the timer lives and dies with the row: mounting starts a fresh
// countdown and unmounting discards it, which is what makes a second load (after
// a retry) start again from "Adatok betöltése…" without any explicit reset.
function LoadingRow() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="loading-banner" role="status" aria-live="polite">
      <span className="loading-banner-spinner" aria-hidden="true" />
      <span className="loading-banner-text">
        {slow
          ? "A szerver épp felébred, ez akár egy percig is tarthat…"
          : "Adatok betöltése…"}
      </span>
    </div>
  );
}

// A single strip above the main content that reports whether the app is still
// waiting on data, and offers a retry when the catalog request failed. Rendered
// above <main> rather than inside it, so the tabs and the search field stay
// usable while data is in flight.
//
// Purely presentational: the caller decides when it is loading and when it has
// an error.
export default function LoadingBanner({ loading, error, onRetry }) {
  // An error outranks a still-running load: a failed catalog fetch is the thing
  // the user can act on.
  if (error) {
    return (
      <div className="loading-banner is-error" role="alert">
        <Icon name="xmark" size={13} />
        <span className="loading-banner-text">
          Nem sikerült még betölteni az adatokat. Várj egy kicsit és próbáld újra, vagy frissítsd az oldalt.
        </span>
        {onRetry && (
          <button
            type="button"
            className="btn-pill btn-outline btn-outline-neutral loading-banner-retry"
            onClick={onRetry}
          >
            Újrapróbálom
          </button>
        )}
      </div>
    );
  }

  if (!loading) return null;

  return <LoadingRow />;
}
