// Turns a failed /api/ai/* response into something a cook can act on.
//
// The backend answers with a stable `code`; the Hungarian wording lives here so
// it can be reworded without touching the server. Anything unrecognized falls
// back to the server's own message, then to a generic line.
const MESSAGES = {
  AI_MODEL_NOT_FOUND:
    "A beállított AI modell nem érhető el — valószínűleg megszűnt. Ezt fejlesztőnek kell javítania.",
  AI_AUTH: "Az AI hozzáférés nincs rendben. Ezt fejlesztőnek kell javítania.",
  AI_OVERLOADED:
    "Az AI éppen túlterhelt. Próbáld újra néhány másodperc múlva.",
  AI_TIMEOUT: "Az AI túl sokáig gondolkodott. Próbáld újra.",
  AI_INVALID_JSON: "Az AI válasza hibás formátumú volt. Próbáld újra.",
  AI_BAD_REQUEST: "Az AI elutasította a kérést. Próbáld újra.",
  AI_NOT_FEASIBLE:
    "Ebből a hozzávaló-listából nem készíthető el ez az étel. Válassz másikat.",
};

// The free tier caps both requests per minute and requests per day, and the quota
// is per project rather than per user -- so "wait a bit" and "come back tomorrow"
// are genuinely different answers. A retry hint means the shorter one.
function quotaMessage(retryAfterSeconds) {
  if (retryAfterSeconds && retryAfterSeconds <= 300) {
    return `Az AI percenkénti keretét elhasználtuk. Próbáld újra kb. ${retryAfterSeconds} másodperc múlva.`;
  }
  return "Az AI napi ingyenes keretét elhasználtuk. Próbáld újra holnap.";
}

export function aiErrorMessage(status, data) {
  const code = data?.code;

  if (code === "AI_QUOTA") {
    return quotaMessage(data?.retry_after_seconds);
  }

  if (code && MESSAGES[code]) return MESSAGES[code];

  // Our own per-user limiter, which answers before the request ever reaches the
  // model and therefore carries no code.
  if (status === 429) {
    return "Túl sok AI kérés rövid idő alatt. Várj pár percet, aztán próbáld újra.";
  }

  if (data?.error === "Fridge is empty") return "A hűtő üres";

  return data?.error || "AI hiba";
}
