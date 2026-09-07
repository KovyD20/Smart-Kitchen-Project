// Turning HTML into text the model can read.
//
// Shared by both import paths: `recipeJsonLd` needs it because schema.org fields
// routinely carry markup ("<p>Keverd össze</p>"), and the raw-page fallback needs
// it for the whole document.

// Cap what reaches the model. A recipe -- ingredients plus steps -- lives well
// inside this; the rest of a typical page is navigation, comments and ads.
const MAX_TEXT_CHARS = 20000;

// Named entities worth knowing. The accented set is not optional decoration: a
// page written as "s&oacute;" is common, and leaving it undecoded puts the raw
// "&oacute;" into the prompt, where it reaches the saved recipe as gibberish.
// Hungarian needs ő and ű too, which are `odblac`/`udblac`.
const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  ouml: "ö",
  odblac: "ő",
  otilde: "ő", // seen in place of odblac on older pages
  uacute: "ú",
  uuml: "ü",
  udblac: "ű",
  ucirc: "ű", // likewise
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Ouml: "Ö",
  Odblac: "Ő",
  Uacute: "Ú",
  Uuml: "Ü",
  Udblac: "Ű",
};

function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16)),
    )
    // Exact match first, so `&Aacute;` keeps its capital; the lowercase lookup
    // then catches spelling variants like `&AMP;`.
    .replace(
      /&([a-z]+);/gi,
      (match, name) => ENTITIES[name] ?? ENTITIES[name.toLowerCase()] ?? match,
    );
}

// Strips a page down to readable text. Deliberately crude -- it is the fallback
// for pages that carry no structured data.
function htmlToText(html) {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;

  return decodeEntities(
    body
      .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      // Block-level tags become newlines so ingredient lists and steps do not
      // run together into one unreadable line.
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

// A single field (an ingredient line, one instruction) flattened to one line.
// Newlines would break the "one item per line" shape the prompt relies on.
function fieldToText(value) {
  if (typeof value !== "string") return "";
  return htmlToText(value).replace(/\s*\n\s*/g, " ").trim();
}

module.exports = { htmlToText, fieldToText, decodeEntities, MAX_TEXT_CHARS };
