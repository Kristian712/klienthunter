/**
 * Trade → CZ-NACE codes, and the Czech words that businesses of that trade put in their name.
 *
 * Every code here was verified against live ARES counts, not taken from the official CZ-NACE
 * table — ARES stores whatever revision and granularity each subject declared, so plenty of
 * "correct" codes return zero rows. Codes for the trades that had no working guess were
 * derived by sampling real companies found by name and counting their actual `czNace` values.
 *
 * Two consequences worth remembering:
 *  - NACE is *declared*, not audited. A firm may carry a dozen unrelated codes.
 *  - Many firms carry no NACE at all, which is why every trade also has name keywords.
 */

export interface NicheQuery {
  /** CZ-NACE codes as ARES actually stores them. */
  nace: string[];
  /** Words that appear in the business name. Used as a second, independent ARES query. */
  keywords: string[];
  /** OpenStreetMap tag filters, as `key=value`. */
  osm: string[];
}

/**
 * `46900` (unspecialised wholesale) is the catch-all code half of all Czech firms declare.
 * It matches everything and therefore identifies nothing — never put it in a query.
 */
export const USELESS_NACE = new Set(['46900', '4690', '00', '74', '741', '68200', 'G']);

export const NICHE_MAP: Record<string, NicheQuery> = {
  'plumber':              { nace: ['4322'],            keywords: ['instalatér', 'vodoinstalatér', 'topenář'], osm: ['craft=plumber'] },
  'electrician':          { nace: ['43210'],           keywords: ['elektro', 'elektroinstalace', 'elektrikář'], osm: ['craft=electrician'] },
  'carpenter':            { nace: ['43320', '16230'],  keywords: ['truhlářství', 'tesařství'], osm: ['craft=carpenter', 'craft=joiner'] },
  'painter':              { nace: ['43340'],           keywords: ['malířství', 'malby', 'nátěry'], osm: ['craft=painter'] },
  'roofer':               { nace: ['43910'],           keywords: ['pokrývačství', 'střechy'], osm: ['craft=roofer'] },
  'landscaper':           { nace: ['81300'],           keywords: ['zahradnictví', 'zahradní'], osm: ['craft=gardener', 'shop=garden_centre'] },
  'restaurant':           { nace: ['56300'],           keywords: ['restaurace', 'hostinec'], osm: ['amenity=restaurant'] },
  'cafe':                 { nace: ['56300'],           keywords: ['kavárna', 'café'], osm: ['amenity=cafe'] },
  'bakery':               { nace: ['10710', '47240'],  keywords: ['pekárna', 'pekařství'], osm: ['shop=bakery'] },
  'butcher shop':         { nace: ['47220', '10110'],  keywords: ['řeznictví', 'masna'], osm: ['shop=butcher'] },
  'hair salon':           { nace: ['96210'],           keywords: ['kadeřnictví', 'kadeřnic'], osm: ['shop=hairdresser'] },
  'beauty salon':         { nace: ['96210', '96230'],  keywords: ['kosmetika', 'kosmetický'], osm: ['shop=beauty'] },
  'nail studio':          { nace: ['96210'],           keywords: ['nehtové studio', 'nehtová'], osm: ['shop=beauty'] },
  'massage':              { nace: ['96230'],           keywords: ['masáže', 'masážní'], osm: ['shop=massage'] },
  'car repair':           { nace: ['95310'],           keywords: ['autoservis', 'automobilový servis'], osm: ['shop=car_repair'] },
  'tire shop':            { nace: ['95310'],           keywords: ['pneuservis', 'pneu'], osm: ['shop=tyres'] },
  'accountant':           { nace: ['69200'],           keywords: ['účetnictví', 'účetní'], osm: ['office=accountant'] },
  'photographer':         { nace: ['74200'],           keywords: ['fotograf', 'fotoateliér'], osm: ['craft=photographer'] },
  'cleaning service':     { nace: ['81210', '81220'],  keywords: ['úklid', 'úklidové'], osm: ['shop=laundry'] },
  'veterinarian':         { nace: ['75000'],           keywords: ['veterinární', 'veterina'], osm: ['amenity=veterinary'] },
  'general practitioner': { nace: ['86210'],           keywords: ['praktický lékař', 'ordinace'], osm: ['amenity=doctors'] },
  'dentist':              { nace: ['86230'],           keywords: ['zubní', 'stomatolog', 'dentál'], osm: ['amenity=dentist'] },
  'physiotherapist':      { nace: ['96230'],           keywords: ['fyzioterapie', 'rehabilitace'], osm: ['healthcare=physiotherapist'] },
  'pharmacy':             { nace: ['47730'],           keywords: ['lékárna'], osm: ['amenity=pharmacy'] },
  'optician':             { nace: ['47780'],           keywords: ['optika', 'oční optika'], osm: ['shop=optician'] },
  'lawyer':               { nace: ['69100'],           keywords: ['advokát', 'advokátní'], osm: ['office=lawyer'] },
  'real estate agency':   { nace: ['68310'],           keywords: ['reality', 'realitní'], osm: ['office=estate_agent'] },
  'driving school':       { nace: ['85530'],           keywords: ['autoškola'], osm: ['amenity=driving_school'] },
  'language school':      { nace: ['8559'],            keywords: ['jazyková škola', 'jazykov'], osm: ['amenity=language_school'] },
  'gym':                  { nace: ['93130'],           keywords: ['fitness', 'posilovna'], osm: ['leisure=fitness_centre'] },
  'personal trainer':     { nace: ['85510'],           keywords: ['osobní trenér', 'trenér'], osm: ['leisure=fitness_centre'] },
  'yoga studio':          { nace: ['93130'],           keywords: ['jóga', 'yoga'], osm: ['leisure=fitness_centre'] },
  'florist':              { nace: ['47760'],           keywords: ['květinářství', 'květiny'], osm: ['shop=florist'] },
  'tailor':               { nace: ['95230'],           keywords: ['krejčovství', 'krejčí', 'šití'], osm: ['craft=tailor', 'shop=tailor'] },
  'locksmith':            { nace: ['25620', '25110'],  keywords: ['zámečnictví', 'zámečnic'], osm: ['craft=locksmith'] },
  'glazier':              { nace: ['23120', '43340'],  keywords: ['sklenářství', 'sklenář'], osm: ['craft=glaziery'] },
  'chimney sweep':        { nace: ['81220', '43990'],  keywords: ['kominictví', 'kominík'], osm: ['craft=chimney_sweeper'] },
};

/** Malá písmena bez diakritiky — „Kadeřnictví" i „kadernictvi" má vést na totéž. */
function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/**
 * Klíče mapy jsou anglické slugy, protože zároveň slouží jako `value` v nabídce oborů.
 * Uživatel, který zvolí „Jiný obor (zadat ručně)", ale píše česky — a napíše přesně to slovo,
 * které v `keywords` u daného oboru už stojí.
 *
 * Dokud se hledalo jen podle klíče, skončil takový dotaz na prázdném `osm: []`. A protože
 * OpenStreetMap je jediný zdroj, který nese telefony a e-maily, dostal uživatel sadu firem
 * **bez jediného kontaktu** — tedy přesně to, kvůli čemu si aplikaci otevřel. Nešlo o chybu
 * dat, jen o to, že se v nich nikdo nepodíval.
 *
 * Index se staví jednou při načtení modulu; mapa je konstantní.
 */
const BY_KEYWORD: Array<{ key: string; word: string }> = Object.entries(NICHE_MAP)
  .flatMap(([key, q]) => q.keywords.map(word => ({ key, word: normalize(word) })))
  // Delší slovo vyhrává: „svatební fotograf" má padnout na `fotograf`, ne na `foto` z jiného
  // oboru, a „nehtové studio" na nehtové studio, ne na obecné „studio".
  .sort((a, b) => b.word.length - a.word.length);

/** Kratší jehla než tohle už v cizím názvu trefí náhodu častěji než obor. */
const MIN_SUBSTRING = 4;

/**
 * Přeloží obor na dotazy do zdrojů. Zkouší v pořadí od nejjistějšího:
 * přesný slug → přesné české slovo → české slovo obsažené v dotazu.
 *
 * Když nesedí nic, zůstává původní chování: hledá se jen podle názvu, bez NACE. Lepší úzký
 * výsledek než špatný — hádaný NACE kód by tiše vrátil jiné řemeslo.
 */
export function resolveNiche(industry: string): NicheQuery {
  const exact = NICHE_MAP[industry.toLowerCase()];
  if (exact) return exact;

  const q = normalize(industry);
  if (!q) return { nace: [], keywords: [industry], osm: [] };

  const hit =
    BY_KEYWORD.find(k => k.word === q) ??
    BY_KEYWORD.find(k => k.word.length >= MIN_SUBSTRING && q.includes(k.word));

  if (!hit) return { nace: [], keywords: [industry], osm: [] };

  // Slovo, které uživatel napsal, si necháváme navrch: v názvech firem bývá přesnější než
  // obecné klíčové slovo oboru, a ARES hledá podle názvu.
  const base = NICHE_MAP[hit.key];
  const keywords = [industry, ...base.keywords.filter(w => normalize(w) !== q)];
  return { ...base, keywords };
}
