const COLOR_TO_PRIORITY = {
  FF0000: "essential",
  FFC000: "good_to_have",
  "00B050": "extra",
  "000000": "extra",
};

const PRIORITY_RANK = {
  extra: 1,
  good_to_have: 2,
  essential: 3,
};

const UNKNOWN_CATEGORY = "Egyéb";

const RAW_CATALOG_ROWS = [
  { category: "Zöldségek", color: "FF0000", name: "vöröshagyma" },
  { category: "Zöldségek", color: "FFC000", name: "fokhagyma" },
  { category: "Zöldségek", color: "FFC000", name: "burgonya" },
  { category: "Zöldségek", color: "FF0000", name: "lilahagyma" },
  { category: "Zöldségek", color: "00B050", name: "sárgarépa" },
  { category: "Zöldségek", color: "FFC000", name: "paprika" },
  { category: "Zöldségek", color: "FFC000", name: "paradicsom" },
  { category: "Zöldségek", color: "FFC000", name: "saláta (jégsaláta / fejes)" },
  { category: "Zöldségek", color: "FFC000", name: "uborka" },
  { category: "Zöldségek", color: "00B050", name: "gomba" },
  { category: "Zöldségek", color: "00B050", name: "káposzta" },
  { category: "Zöldségek", color: "FFC000", name: "brokkoli" },
  { category: "Zöldségek", color: "000000", name: "spenót" },
  { category: "Zöldségek", color: "000000", name: "édesburgonya" },
  { category: "Zöldségek", color: "000000", name: "chili paprika" },
  { category: "Zöldségek", color: "000000", name: "jégcsapretek" },
  { category: "Zöldségek", color: "000000", name: "karfiol" },
  { category: "Zöldségek", color: "000000", name: "cukkini" },
  { category: "Zöldségek", color: "000000", name: "padlizsán" },
  { category: "Zöldségek", color: "000000", name: "zöldhagyma" },
  { category: "Zöldségek", color: "000000", name: "póréhagyma" },
  { category: "Zöldségek", color: "000000", name: "cékla" },
  { category: "Zöldségek", color: "000000", name: "kukorica" },
  { category: "Zöldségek", color: "000000", name: "zeller" },
  { category: "Zöldségek", color: "000000", name: "retek" },
  { category: "Zöldségek", color: "000000", name: "karalábé" },
  { category: "Zöldségek", color: "000000", name: "torma" },
  { category: "Zöldségek", color: "000000", name: "kelkáposzta" },
  { category: "Zöldségek", color: "000000", name: "bimbós kel" },
  { category: "Zöldségek", color: "000000", name: "patisszon" },
  { category: "Zöldségek", color: "000000", name: "zöldborsó" },
  { category: "Zöldségek", color: "000000", name: "zöldbab" },
  { category: "Zöldségek", color: "000000", name: "szójabab" },
  { category: "Zöldségek", color: "000000", name: "sóska" },
  { category: "Zöldségek", color: "000000", name: "petrezselyem (zöldség)" },
  { category: "Zöldségek", color: "000000", name: "snidling" },
  { category: "Zöldségek", color: "000000", name: "madársaláta" },
  { category: "Zöldségek", color: "000000", name: "bazsalikom (zöldség)" },
  { category: "Zöldségek", color: "000000", name: "sütőtök" },
  { category: "Zöldségek", color: "000000", name: "spárga" },
  { category: "Gyümölcsök", color: "FFC000", name: "citrom" },
  { category: "Gyümölcsök", color: "00B050", name: "lime" },
  { category: "Gyümölcsök", color: "FF0000", name: "alma" },
  { category: "Gyümölcsök", color: "FF0000", name: "banán" },
  { category: "Gyümölcsök", color: "FFC000", name: "körte" },
  { category: "Gyümölcsök", color: "FFC000", name: "narancs" },
  { category: "Gyümölcsök", color: "FFC000", name: "mandarin" },
  { category: "Gyümölcsök", color: "FFC000", name: "szőlő" },
  { category: "Gyümölcsök", color: "FFC000", name: "eper" },
  { category: "Gyümölcsök", color: "FFC000", name: "őszibarack" },
  { category: "Gyümölcsök", color: "00B050", name: "nektarin" },
  { category: "Gyümölcsök", color: "00B050", name: "görögdinnye" },
  { category: "Gyümölcsök", color: "00B050", name: "sárgadinnye" },
  { category: "Gyümölcsök", color: "00B050", name: "kivi" },
  { category: "Gyümölcsök", color: "00B050", name: "szilva" },
  { category: "Gyümölcsök", color: "00B050", name: "kajszibarack" },
  { category: "Gyümölcsök", color: "00B050", name: "cseresznye" },
  { category: "Gyümölcsök", color: "00B050", name: "meggy" },
  { category: "Gyümölcsök", color: "00B050", name: "ribizli" },
  { category: "Gyümölcsök", color: "00B050", name: "málna" },
  { category: "Gyümölcsök", color: "00B050", name: "áfonya" },
  { category: "Gyümölcsök", color: "00B050", name: "füge" },
  { category: "Gyümölcsök", color: "00B050", name: "gránátalma" },
  { category: "Gyümölcsök", color: "00B050", name: "datolya" },
  { category: "Gyümölcsök", color: "00B050", name: "kókusz" },
  { category: "Gyümölcsök", color: "00B050", name: "pomelo" },
  { category: "Gyümölcsök", color: "00B050", name: "grapefruit" },
  { category: "Gyümölcsök", color: "00B050", name: "ananász" },
  { category: "Gyümölcsök", color: "00B050", name: "mangó" },
  { category: "Gyümölcsök", color: "00B050", name: "avokádó" },
  { category: "Gyümölcsök", color: "00B050", name: "sárkánygyümölcs (pitaja)" },
  { category: "Gyümölcsök", color: "00B050", name: "papaya" },
  { category: "Gyümölcsök", color: "00B050", name: "maracuja" },
  { category: "Pékáruk", color: "FF0000", name: "kenyér" },
  { category: "Pékáruk", color: "00B050", name: "zsemle" },
  { category: "Pékáruk", color: "00B050", name: "kifli" },
  { category: "Pékáruk", color: "00B050", name: "toast kenyér" },
  { category: "Pékáruk", color: "00B050", name: "tortilla" },
  { category: "Pékáruk", color: "00B050", name: "bagett" },
  { category: "Pékáruk", color: "00B050", name: "hamburgerzsemle" },
  { category: "Pékáruk", color: "00B050", name: "hot-dog kifli" },
  { category: "Húsfélék", color: "FF0000", name: "csirkemell" },
  { category: "Húsfélék", color: "00B050", name: "csirkecomb" },
  { category: "Húsfélék", color: "00B050", name: "csirkeszárny" },
  { category: "Húsfélék", color: "00B050", name: "egész csirke" },
  { category: "Húsfélék", color: "00B050", name: "pulykamell" },
  { category: "Húsfélék", color: "00B050", name: "pulykasonka" },
  { category: "Húsfélék", color: "00B050", name: "sertéstarja" },
  { category: "Húsfélék", color: "00B050", name: "sertéslapocka" },
  { category: "Húsfélék", color: "00B050", name: "sertésoldalas" },
  { category: "Húsfélék", color: "00B050", name: "marhahús" },
  { category: "Húsfélék", color: "00B050", name: "darált marhahús" },
  { category: "Húsfélék", color: "FFC000", name: "darált sertés" },
  { category: "Húsfélék", color: "00B050", name: "darált vegyes hús" },
  { category: "Húsfélék", color: "00B050", name: "garnéla" },
  { category: "Húsfélék", color: "FFC000", name: "hal" },
  { category: "Felvágottak", color: "FFC000", name: "szalonna" },
  { category: "Felvágottak", color: "FFC000", name: "darált hús" },
  { category: "Felvágottak", color: "FFC000", name: "sertéskaraj" },
  { category: "Felvágottak", color: "FF0000", name: "kolbász" },
  { category: "Felvágottak", color: "FF0000", name: "sonka" },
  { category: "Felvágottak", color: "FFC000", name: "szalámi" },
  { category: "Felvágottak", color: "FFC000", name: "virsli" },
  { category: "Felvágottak", color: "FFC000", name: "bacon" },
  { category: "Felvágottak", color: "FFC000", name: "párizsi" },
  { category: "Felvágottak", color: "FFC000", name: "sonka" },
  { category: "Felvágottak", color: "FFC000", name: "felvágott" },
  { category: "Tejtermékek, tojás", color: "FF0000", name: "tej" },
  { category: "Tejtermékek, tojás", color: "FF0000", name: "vaj / margarin" },
  { category: "Tejtermékek, tojás", color: "FFC000", name: "sajt (trappista / félkemény)" },
  { category: "Tejtermékek, tojás", color: "FFC000", name: "tejföl" },
  { category: "Tejtermékek, tojás", color: "FFC000", name: "joghurt" },
  { category: "Tejtermékek, tojás", color: "FF0000", name: "tojás" },
  { category: "Tejtermékek, tojás", color: "00B050", name: "túró" },
  { category: "Tejtermékek, tojás", color: "FFC000", name: "tejszín" },
  { category: "Tejtermékek, tojás", color: "00B050", name: "krémsajt" },
  { category: "Tejtermékek, tojás", color: "00B050", name: "kefir" },
  { category: "Tejtermékek, tojás", color: "00B050", name: "író" },
  { category: "Tejtermékek, tojás", color: "00B050", name: "mascarpone" },
  { category: "Tejtermékek, tojás", color: "00B050", name: "ricotta" },
  { category: "Tejtermékek, tojás", color: "00B050", name: "feta" },
  { category: "Tejtermékek, tojás", color: "00B050", name: "mozzarella" },
  { category: "Tejtermékek, tojás", color: "00B050", name: "pamezán" },
  { category: "Tejtermékek, tojás", color: "00B050", name: "camambert" },
  { category: "Tejtermékek, tojás", color: "00B050", name: "brie" },
  { category: "Tejtermékek, tojás", color: "00B050", name: "sajtkrém" },
  { category: "Tejtermékek, tojás", color: "00B050", name: "desszertkrém" },
  { category: "Tejtermékek, tojás", color: "00B050", name: "tejes" },
  { category: "Fagyasztott termékek", color: "00B050", name: "fagyasztott zöldség" },
  { category: "Fagyasztott termékek", color: "00B050", name: "fagyasztott gyümölcs" },
  { category: "Fagyasztott termékek", color: "00B050", name: "fagyasztott spenót" },
  { category: "Fagyasztott termékek", color: "00B050", name: "fagyasztott borsó" },
  { category: "Fagyasztott termékek", color: "FF0000", name: "fagyasztott pizza" },
  { category: "Fagyasztott termékek", color: "00B050", name: "fagyasztott hús" },
  { category: "Fagyasztott termékek", color: "00B050", name: "fagyaszott krumpli" },
  { category: "Fagyasztott termékek", color: "00B050", name: "fagyasztott hal" },
  { category: "Fagyasztott termékek", color: "00B050", name: "jégkrém" },
  { category: "Szárazáru", color: "FF0000", name: "liszt" },
  { category: "Szárazáru", color: "FF0000", name: "rizs" },
  { category: "Szárazáru", color: "FFC000", name: "tészta" },
  { category: "Szárazáru", color: "00B050", name: "kuszkusz" },
  { category: "Szárazáru", color: "00B050", name: "bulgur" },
  { category: "Szárazáru", color: "FFC000", name: "zsemlemorzsa" },
  { category: "Szárazáru", color: "FFC000", name: "búzadara" },
  { category: "Szárazáru", color: "00B050", name: "kukoricadara" },
  { category: "Szárazáru", color: "00B050", name: "lencse" },
  { category: "Szárazáru", color: "00B050", name: "szárazbab" },
  { category: "Szárazáru", color: "00B050", name: "zabpehely" },
  { category: "Szárazáru", color: "FFC000", name: "konzerv kukorica" },
  { category: "Szárazáru", color: "00B050", name: "konzerv paradicsom" },
  { category: "Szárazáru", color: "FFC000", name: "konzerv bab" },
  { category: "Szárazáru", color: "FFC000", name: "konzerv hal" },
  { category: "Szárazáru", color: "00B050", name: "konzerv csicseriborsó" },
  { category: "Szárazáru", color: "FF0000", name: "étolaj" },
  { category: "Szárazáru", color: "FF0000", name: "olívaolaj" },
  { category: "Szárazáru", color: "FF0000", name: "konzerv hal" },
  { category: "Szárazáru", color: "FFC000", name: "lekvár" },
  { category: "Szárazáru", color: "FFC000", name: "méz" },
  { category: "Szárazáru", color: "00B050", name: "mogyoróvaj" },
  { category: "Szárazáru", color: "FFC000", name: "nutella" },
  { category: "Szárazáru", color: "00B050", name: "kakaópor" },
  { category: "Szárazáru", color: "00B050", name: "élesztő" },
  { category: "Szárazáru", color: "00B050", name: "keményítő" },
  { category: "Szárazáru", color: "00B050", name: "köles" },
  { category: "Fűszerek, ízesítők", color: "FF0000", name: "cukor" },
  { category: "Fűszerek, ízesítők", color: "FF0000", name: "porcukor" },
  { category: "Fűszerek, ízesítők", color: "FFC000", name: "vanilliacukor" },
  { category: "Fűszerek, ízesítők", color: "FF0000", name: "só" },
  { category: "Fűszerek, ízesítők", color: "FF0000", name: "fekete bors" },
  { category: "Fűszerek, ízesítők", color: "FFC000", name: "pirospaprika" },
  { category: "Fűszerek, ízesítők", color: "FFC000", name: "majoranna" },
  { category: "Fűszerek, ízesítők", color: "FFC000", name: "oregánó" },
  { category: "Fűszerek, ízesítők", color: "FFC000", name: "bazsalikom" },
  { category: "Fűszerek, ízesítők", color: "FFC000", name: "fahéj" },
  { category: "Fűszerek, ízesítők", color: "FFC000", name: "babérlevél" },
  { category: "Fűszerek, ízesítők", color: "FFC000", name: "kömény" },
  { category: "Fűszerek, ízesítők", color: "00B050", name: "szójaszósz" },
  { category: "Fűszerek, ízesítők", color: "FFC000", name: "mustár" },
  { category: "Fűszerek, ízesítők", color: "FF0000", name: "ketchup" },
  { category: "Fűszerek, ízesítők", color: "FF0000", name: "majonéz" },
  { category: "Fűszerek, ízesítők", color: "FFC000", name: "ecet" },
  { category: "Fűszerek, ízesítők", color: "00B050", name: "BBQ szósz" },
  { category: "Fűszerek, ízesítők", color: "00B050", name: "szódabikarbóna" },
  { category: "Fűszerek, ízesítők", color: "00B050", name: "sütőpor" },
  { category: "Üdítők, italok", color: "00B050", name: "ásványvíz" },
  { category: "Üdítők, italok", color: "00B050", name: "szörp" },
  { category: "Üdítők, italok", color: "FFC000", name: "üdítő" },
  { category: "Üdítők, italok", color: "00B050", name: "gyümölcslé" },
  { category: "Üdítők, italok", color: "FFC000", name: "sör" },
  { category: "Üdítők, italok", color: "00B050", name: "fehérbor" },
  { category: "Üdítők, italok", color: "00B050", name: "vörösbor" },
  { category: "Üdítők, italok", color: "00B050", name: "vodka" },
  { category: "Üdítők, italok", color: "00B050", name: "whisky" },
  { category: "Üdítők, italok", color: "00B050", name: "pálinka" },
  { category: "Üdítők, italok", color: "FFC000", name: "kávé" },
  { category: "Üdítők, italok", color: "FFC000", name: "tea" },
  { category: "9. Snackek", color: "FFC000", name: "keksz" },
  { category: "9. Snackek", color: "FFC000", name: "csokoládé" },
  { category: "9. Snackek", color: "FFC000", name: "chips" },
  { category: "9. Snackek", color: "FFC000", name: "sós ropogtatni való" },
  { category: "9. Snackek", color: "FFC000", name: "mogyoró" },
  { category: "9. Snackek", color: "00B050", name: "dió" },
  { category: "9. Snackek", color: "00B050", name: "mandula" },
  { category: "9. Snackek", color: "FFC000", name: "napraforgómag (szotyi)" },
  { category: "9. Snackek", color: "00B050", name: "tökmag" },
  { category: "9. Snackek", color: "FFC000", name: "müzli" },
  { category: "9. Snackek", color: "FFC000", name: "müzli szelet" },
  { category: "9. Snackek", color: "00B050", name: "kukoricapehely" },
  { category: "9. Snackek", color: "00B050", name: "zabpehely" },
  { category: "10. Háztartási alapcikkek (konyha)", color: "FF0000", name: "papírtörlő" },
  { category: "10. Háztartási alapcikkek (konyha)", color: "FF0000", name: "mosogatószer" },
  { category: "10. Háztartási alapcikkek (konyha)", color: "FF0000", name: "szemeteszsák" },
  { category: "10. Háztartási alapcikkek (konyha)", color: "FF0000", name: "alufólia" },
  { category: "10. Háztartási alapcikkek (konyha)", color: "FF0000", name: "sütőpapír" },
  { category: "10. Háztartási alapcikkek (konyha)", color: "FF0000", name: "szivacs" },
  { category: "10. Háztartási alapcikkek (konyha)", color: "FF0000", name: "kézmosó szappan" },
  { category: "11. Háztartási alapcikkek (fürdő)", color: "FF0000", name: "mosószer" },
  { category: "11. Háztartási alapcikkek (fürdő)", color: "FF0000", name: "toalettpapír" },
  { category: "11. Háztartási alapcikkek (fürdő)", color: "FF0000", name: "tusfürdő" },
  { category: "11. Háztartási alapcikkek (fürdő)", color: "FF0000", name: "sampon" },
  { category: "11. Háztartási alapcikkek (fürdő)", color: "FF0000", name: "fogkrém" },
  { category: "11. Háztartási alapcikkek (fürdő)", color: "FF0000", name: "fogkefe" },
  { category: "11. Háztartási alapcikkek (fürdő)", color: "FF0000", name: "tisztítószer" },
];

const MANUAL_SYNONYMS = {
  krumpli: "burgonya",
  krumplit: "burgonya",
  burgonyat: "burgonya",
  "edes burgonya": "édesburgonya",
  "edeskrumpli": "édesburgonya",
  "voros hagyma": "vöröshagyma",
  "piros hagyma": "vöröshagyma",
  "lila hagyma": "lilahagyma",
  "fagyasztott krumpli": "fagyaszott krumpli",
  "jegsalata": "saláta (jégsaláta / fejes)",
  "fejes salata": "saláta (jégsaláta / fejes)",
  salata: "saláta (jégsaláta / fejes)",
  margarin: "vaj / margarin",
  vaj: "vaj / margarin",
  trappista: "sajt (trappista / félkemény)",
  "felkemeny sajt": "sajt (trappista / félkemény)",
  "wc papir": "toalettpapír",
  "wc-papir": "toalettpapír",
  "toalett papir": "toalettpapír",
  pitaja: "sárkánygyümölcs (pitaja)",
  szotyi: "napraforgómag (szotyi)",
};

export function normalizeCatalogText(value) {
  const base = (value || "").toString().trim().toLocaleLowerCase("hu-HU");
  if (!base) return "";

  const ascii = base.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ascii
    .replace(/[()]/g, " ")
    .replace(/[\\/]/g, " ")
    .replace(/[-_,.;:!+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCategory(value) {
  return (value || "")
    .toString()
    .trim()
    .replace(/^\d+\.\s*/, "")
    .trim();
}

function collectAliases(name) {
  const source = (name || "").toString().trim();
  if (!source) return [];

  const aliases = new Set([source]);
  const withoutParentheses = source.replace(/\([^)]*\)/g, "").trim();
  if (withoutParentheses) {
    aliases.add(withoutParentheses);
  }

  source
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => aliases.add(part));

  const groupMatches = source.match(/\(([^)]+)\)/);
  if (groupMatches?.[1]) {
    groupMatches[1]
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => aliases.add(part));
  }

  return Array.from(aliases);
}

const categoryOrder = [];
const categoryIndex = new Map();
const catalogByKey = new Map();
const aliasToEntry = new Map();

function ensureCategory(category) {
  if (categoryIndex.has(category)) return;
  categoryIndex.set(category, categoryOrder.length);
  categoryOrder.push(category);
}

for (const row of RAW_CATALOG_ROWS) {
  const category = normalizeCategory(row.category);
  ensureCategory(category);

  const key = normalizeCatalogText(row.name);
  if (!key) continue;

  const priority = COLOR_TO_PRIORITY[row.color] || "extra";
  const existing = catalogByKey.get(key);
  if (!existing) {
    catalogByKey.set(key, {
      key,
      name: row.name,
      category,
      priority,
    });
    continue;
  }

  const incomingRank = PRIORITY_RANK[priority] || 0;
  const existingRank = PRIORITY_RANK[existing.priority] || 0;
  if (incomingRank > existingRank) {
    existing.priority = priority;
  }
}

function registerAlias(alias, entry) {
  const aliasKey = normalizeCatalogText(alias);
  if (!aliasKey || !entry) return;

  const existing = aliasToEntry.get(aliasKey);
  if (!existing) {
    aliasToEntry.set(aliasKey, entry);
    return;
  }

  const existingRank = PRIORITY_RANK[existing.priority] || 0;
  const incomingRank = PRIORITY_RANK[entry.priority] || 0;
  if (incomingRank > existingRank) {
    aliasToEntry.set(aliasKey, entry);
  }
}

for (const row of RAW_CATALOG_ROWS) {
  const entry = catalogByKey.get(normalizeCatalogText(row.name));
  if (!entry) continue;
  collectAliases(row.name).forEach((alias) => registerAlias(alias, entry));
}

for (const [alias, canonical] of Object.entries(MANUAL_SYNONYMS)) {
  const targetKey = normalizeCatalogText(canonical);
  const targetEntry =
    aliasToEntry.get(targetKey) || catalogByKey.get(targetKey) || null;
  if (targetEntry) {
    registerAlias(alias, targetEntry);
  }
}

function compareEntries(a, b) {
  const categoryDiff =
    (categoryIndex.get(a.category) ?? Number.MAX_SAFE_INTEGER) -
    (categoryIndex.get(b.category) ?? Number.MAX_SAFE_INTEGER);
  if (categoryDiff !== 0) return categoryDiff;
  return a.name.localeCompare(b.name, "hu-HU", { sensitivity: "base" });
}

export const CATALOG_ITEMS = Array.from(catalogByKey.values()).sort(compareEntries);

export function resolveCatalogKey(name) {
  const key = normalizeCatalogText(name);
  if (!key) return "";
  return aliasToEntry.get(key)?.key || key;
}

export function resolveCanonicalCatalogName(name) {
  const key = normalizeCatalogText(name);
  if (!key) return "";
  const match = aliasToEntry.get(key) || catalogByKey.get(key);
  return match ? match.name : (name || "").toString().trim();
}

export function getCatalogItemByName(name) {
  const key = resolveCatalogKey(name);
  if (!key) return null;
  return catalogByKey.get(key) || null;
}

export function groupItemsByCatalog(items) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const grouped = new Map();
  for (const item of items) {
    const meta = getCatalogItemByName(item?.name);
    const category = meta?.category || UNKNOWN_CATEGORY;
    const displayName = meta?.name || (item?.name || "").toString().trim();
    const enrichedItem = {
      ...item,
      displayName,
      nameKey: resolveCatalogKey(displayName),
      category,
      priority: meta?.priority || null,
    };

    const list = grouped.get(category) || [];
    list.push(enrichedItem);
    grouped.set(category, list);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => {
      const aIndex = categoryIndex.get(a[0]) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = categoryIndex.get(b[0]) ?? Number.MAX_SAFE_INTEGER;
      if (aIndex !== bIndex) return aIndex - bIndex;
      return a[0].localeCompare(b[0], "hu-HU", { sensitivity: "base" });
    })
    .map(([category, groupItems]) => ({
      category,
      items: groupItems.sort((a, b) =>
        (a.displayName || "").localeCompare(b.displayName || "", "hu-HU", {
          sensitivity: "base",
        }),
      ),
    }));
}

export function getMissingCatalogRecommendations(fridgeItems, shoppingItems) {
  const present = new Set(
    [...(fridgeItems || []), ...(shoppingItems || [])]
      .map((item) => resolveCatalogKey(item?.name))
      .filter(Boolean),
  );

  const essential = [];
  const goodToHave = [];
  const extra = [];

  for (const item of CATALOG_ITEMS) {
    if (present.has(item.key)) continue;

    if (item.priority === "essential") {
      essential.push(item);
      continue;
    }
    if (item.priority === "good_to_have") {
      goodToHave.push(item);
      continue;
    }
    extra.push(item);
  }

  return { essential, goodToHave, extra };
}
