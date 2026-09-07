import { useState } from "react";
import { authedFetch } from "../../lib/api";
import { aiErrorMessage } from "../../lib/aiErrors";
import Icon from "../Icon/Icon";
import "./ImportRecipePanel.css";

// The third way into a new recipe, alongside typing it and generating one: paste
// the link of a recipe that already exists somewhere on the web.
//
// It does not save anything. The result is handed to the recipe form, because an
// import can misread an amount, and fixing that before saving is far better than
// correcting a recipe that is already in the list.
export default function ImportRecipePanel({ onImported }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canImport = Boolean(url.trim()) && !loading;

  const handleImport = async () => {
    const trimmed = url.trim();
    if (!trimmed || loading) return;

    setError("");
    setLoading(true);

    try {
      const res = await authedFetch("/api/ai/recipe-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        // aiErrorMessage already knows every URL_* code the endpoint can return.
        setError(aiErrorMessage(res.status, data));
        return;
      }

      onImported?.(data.recipe, data.sourceUrl || trimmed);
      setUrl("");
    } catch {
      setError("A beolvasás nem sikerült");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="import-panel">
      <div className="import-head">
        <Icon name="link" size={13} color="var(--blue)" />
        <span className="import-title">Van meglévő recepted linken?</span>
      </div>

      <div className="import-row">
        <input
          className="field import-field"
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck="false"
          placeholder="https://…"
          aria-label="Recept linkje"
          value={url}
          disabled={loading}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleImport();
          }}
        />

        <button
          type="button"
          className="btn-pill btn-solid import-btn"
          style={{ "--accent": "var(--blue)" }}
          disabled={!canImport}
          onClick={handleImport}
        >
          {loading ? "Beolvasás…" : "Beolvasás"}
        </button>
      </div>

      {loading && (
        // Worth saying out loud: this waits on someone else's server and then on
        // the model, so a few seconds of nothing is normal, not a hang.
        <div className="import-hint">
          Letöltjük az oldalt, és kiolvassuk belőle a receptet — ez eltarthat pár
          másodpercig.
        </div>
      )}

      {error && (
        <div className="import-error" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
