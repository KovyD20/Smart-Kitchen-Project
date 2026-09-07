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
  // Link import. These are page problems, not AI problems -- the wording has to
  // say which side went wrong, or the user retries forever.
  URL_INVALID: "Ez nem érvényes webcím. Másold be a recept oldalának teljes linkjét.",
  URL_PRIVATE: "Ez a cím nem érhető el.",
  URL_TIMEOUT: "Az oldal túl lassan válaszolt. Próbáld újra.",
  URL_BLOCKED:
    "Ez az oldal nem engedi a beolvasást. Másold be a recept szövegét kézzel.",
  URL_FETCH_FAILED: "Az oldalt nem sikerült letölteni. Ellenőrizd a linket.",
  URL_TOO_MANY_REDIRECTS:
    "Ez a link túl sokszor irányít tovább. Másold be a recept közvetlen linkjét.",
  URL_NOT_HTML: "Ez a link nem egy weboldal.",
  URL_TOO_LARGE: "Ez az oldal túl nagy a beolvasáshoz.",
  URL_NO_TEXT:
    "Ezen az oldalon nem találtunk olvasható szöveget. Lehet, hogy bejelentkezés kell hozzá.",
  URL_NO_RECIPE: "Ezen az oldalon nem találtunk receptet.",
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
