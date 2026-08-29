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
  /** Jak často u tohohle oboru najdeme web. Viz `YIELD` níž. */
  yield?: YieldBand;
}

/**
 * Odhad, u jaké části firem v oboru se povede dohledat web.
 *
 * Proč to vůbec kolísá: web se dá uhodnout a ověřit jen tam, kde je název firmy vymyšlené
 * slovo („Aldentex", „NebeProZuby") — z „Lenka Nováková" se doména hádat nedá a přilepit
 * cizí web je horší než neříct nic. Obory se tedy dělí podle toho, jestli v nich převažují
 * společnosti, nebo živnostníci se jménem a příjmením.
 *
 * `measured` je skutečné měření na reálném hledání. `high` / `mid` / `low` jsou odhady
 * odvozené z jediné veličiny — podílu s.r.o. proti živnostníkům v daném NACE podle ARESu
 * (změřeno 29. 8. 2026). Je to odhad, ne měření, a UI to takhle i píše.
 *
 * Naměřené kotvy:
 *   • zubaři, Moravskoslezský kraj: 36 webů z 212 firem = 17 %, obor je ze 100 % s.r.o.
 *   • kadeřnictví, Zlínský kraj: 7 z 500 = 1,4 %, obor je z 5 % s.r.o.
 *
 * `unknown` je pro obory, kde ani ten podíl nevyšel spolehlivě — tam se v UI neuvádí nic.
 */
export type YieldBand = 'measured-high' | 'measured-low' | 'high' | 'mid' | 'low' | 'unknown';

/**
 * `46900` (unspecialised wholesale) is the catch-all code half of all Czech firms declare.
 * It matches everything and therefore identifies nothing — never put it in a query.
 */
export const USELESS_NACE = new Set(['46900', '4690', '00', '74', '741', '68200', 'G']);

export const NICHE_MAP: Record<string, NicheQuery> = {
  'plumber':              { nace: ['4322'],            keywords: ['instalatér', 'vodoinstalatér', 'topenář'], osm: ['craft=plumber'], yield: 'low' },
  'electrician':          { nace: ['43210'],           keywords: ['elektro', 'elektroinstalace', 'elektrikář'], osm: ['craft=electrician'], yield: 'unknown' },
  'carpenter':            { nace: ['43320', '16230'],  keywords: ['truhlářství', 'tesařství'], osm: ['craft=carpenter', 'craft=joiner'], yield: 'low' },
  'painter':              { nace: ['43340'],           keywords: ['malířství', 'malby', 'nátěry'], osm: ['craft=painter'], yield: 'low' },
  // 43910 samo vrací tři firmy v celé ČR — kód se prakticky nedeklaruje. Doplněné 43990
  // (ostatní specializované stavební práce) rozšíří záběr; obor stejně stojí hlavně na názvu.
  'roofer':               { nace: ['43910', '43990'],  keywords: ['pokrývačství', 'střechy', 'pokrývač'], osm: ['craft=roofer'], yield: 'unknown' },
  'landscaper':           { nace: ['81300'],           keywords: ['zahradnictví', 'zahradní'], osm: ['craft=gardener', 'shop=garden_centre'], yield: 'high' },
  'restaurant':           { nace: ['56300'],           keywords: ['restaurace', 'hostinec'], osm: ['amenity=restaurant'], yield: 'high' },
  'cafe':                 { nace: ['56300'],           keywords: ['kavárna', 'café'], osm: ['amenity=cafe'], yield: 'high' },
  'bakery':               { nace: ['10710', '47240'],  keywords: ['pekárna', 'pekařství'], osm: ['shop=bakery'], yield: 'mid' },
  'butcher shop':         { nace: ['47220', '10110'],  keywords: ['řeznictví', 'masna'], osm: ['shop=butcher'], yield: 'mid' },
  'hair salon':           { nace: ['96210'],           keywords: ['kadeřnictví', 'kadeřnic'], osm: ['shop=hairdresser'], yield: 'measured-low' },
  'beauty salon':         { nace: ['96210', '96230'],  keywords: ['kosmetika', 'kosmetický'], osm: ['shop=beauty'], yield: 'low' },
  'nail studio':          { nace: ['96210'],           keywords: ['nehtové studio', 'nehtová'], osm: ['shop=beauty'], yield: 'low' },
  'massage':              { nace: ['96230'],           keywords: ['masáže', 'masážní'], osm: ['shop=massage'], yield: 'low' },
  'car repair':           { nace: ['95310'],           keywords: ['autoservis', 'automobilový servis'], osm: ['shop=car_repair'], yield: 'mid' },
  'tire shop':            { nace: ['95310'],           keywords: ['pneuservis', 'pneu'], osm: ['shop=tyres'], yield: 'mid' },
  'accountant':           { nace: ['69200'],           keywords: ['účetnictví', 'účetní'], osm: ['office=accountant'], yield: 'low' },
  'photographer':         { nace: ['74200'],           keywords: ['fotograf', 'fotoateliér'], osm: ['craft=photographer'], yield: 'low' },
  'cleaning service':     { nace: ['81210', '81220'],  keywords: ['úklid', 'úklidové'], osm: ['shop=laundry'], yield: 'mid' },
  'veterinarian':         { nace: ['75000'],           keywords: ['veterinární', 'veterina'], osm: ['amenity=veterinary'], yield: 'high' },
  'general practitioner': { nace: ['86210'],           keywords: ['praktický lékař', 'ordinace'], osm: ['amenity=doctors'], yield: 'high' },
  'dentist':              { nace: ['86230'],           keywords: ['zubní', 'stomatolog', 'dentál'], osm: ['amenity=dentist'], yield: 'measured-high' },
  'physiotherapist':      { nace: ['96230'],           keywords: ['fyzioterapie', 'rehabilitace'], osm: ['healthcare=physiotherapist'], yield: 'low' },
  'pharmacy':             { nace: ['47730'],           keywords: ['lékárna'], osm: ['amenity=pharmacy'], yield: 'high' },
  'optician':             { nace: ['47780'],           keywords: ['optika', 'oční optika'], osm: ['shop=optician'], yield: 'high' },
  'lawyer':               { nace: ['69100'],           keywords: ['advokát', 'advokátní'], osm: ['office=lawyer'], yield: 'high' },
  'real estate agency':   { nace: ['68310'],           keywords: ['reality', 'realitní'], osm: ['office=estate_agent'], yield: 'mid' },
  'driving school':       { nace: ['85530'],           keywords: ['autoškola'], osm: ['amenity=driving_school'], yield: 'mid' },
  'language school':      { nace: ['8559'],            keywords: ['jazyková škola', 'jazykov'], osm: ['amenity=language_school'], yield: 'mid' },
  'gym':                  { nace: ['93130'],           keywords: ['fitness', 'posilovna'], osm: ['leisure=fitness_centre'], yield: 'high' },
  'personal trainer':     { nace: ['85510'],           keywords: ['osobní trenér', 'trenér'], osm: ['leisure=fitness_centre'], yield: 'mid' },
  'yoga studio':          { nace: ['93130'],           keywords: ['jóga', 'yoga'], osm: ['leisure=fitness_centre'], yield: 'high' },
  'florist':              { nace: ['47760'],           keywords: ['květinářství', 'květiny'], osm: ['shop=florist'], yield: 'mid' },
  'tailor':               { nace: ['95230'],           keywords: ['krejčovství', 'krejčí', 'šití'], osm: ['craft=tailor', 'shop=tailor'], yield: 'low' },
  'locksmith':            { nace: ['25620', '25110'],  keywords: ['zámečnictví', 'zámečnic'], osm: ['craft=locksmith'], yield: 'mid' },
  'glazier':              { nace: ['23120', '43340'],  keywords: ['sklenářství', 'sklenář'], osm: ['craft=glaziery'], yield: 'low' },
  'chimney sweep':        { nace: ['81220', '43990'],  keywords: ['kominictví', 'kominík'], osm: ['craft=chimney_sweeper'], yield: 'mid' },
  // ── Doplněno ve vlně 5. Každý kód ověřen proti živému ARESu, že vrací řádky: obecné
  // „stavební firmy" (41, 412, 4120) vracejí nulu, proto tu nejsou.
  'hotel':                { nace: ['55100', '55200'],  keywords: ['hotel', 'penzion', 'ubytování'], osm: ['tourism=hotel', 'tourism=guest_house'], yield: 'mid' },
  'freight':              { nace: ['49410'],           keywords: ['doprava', 'autodoprava', 'přeprava'], osm: [], yield: 'low' },
  'builder':              { nace: ['43990', '43120'],  keywords: ['stavební', 'zednictví', 'stavby'], osm: ['craft=builder'], yield: 'low' },
  'flooring':             { nace: ['43330'],           keywords: ['podlahy', 'podlahářství'], osm: ['shop=flooring'], yield: 'mid' },
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

/**
 * Věta o očekávané výtěžnosti, kterou uživatel vidí před hledáním i nad výsledky.
 *
 * Smyslem není chlubit se číslem, ale zabránit tomu, aby si uživatel po hledání kadeřnictví
 * myslel, že je aplikace rozbitá. Jeden web z padesáti je u živnostníků normální výsledek —
 * a je to lepší než padesát vymyšlených adres.
 *
 * U neměřených oborů věta výslovně říká, že jde o odhad. To není opatrnictví: odhad stojí
 * na jediné veličině (podíl s.r.o. v oboru) a u dvou oborů se ukázalo, že ta veličina může
 * klamat, protože živnostníci si NACE deklarují obecněji než společnosti.
 */
export const YIELD_NOTE: Record<YieldBand, { cs: string; sk?: string; en: string } | null> = {
  'measured-high': {
    cs: 'V tomhle oboru najdeme web zhruba u každé šesté firmy — změřeno na reálném hledání.',
    sk: 'V tomto odbore nájdeme web zhruba u každej šiestej firmy — zmerané na reálnom hľadaní.',
    en: 'In this trade we find a website for roughly one firm in six — measured on a real search.',
  },
  'measured-low': {
    cs: 'V tomhle oboru najdeme web zhruba u jedné firmy z padesáti — změřeno na reálném hledání. Je to normální: většina jsou živnostníci a doména se ze jména a příjmení uhodnout nedá.',
    sk: 'V tomto odbore nájdeme web zhruba u jednej firmy z päťdesiatich — zmerané na reálnom hľadaní. Je to normálne: väčšina sú živnostníci a doména sa z mena a priezviska uhádnuť nedá.',
    en: 'In this trade we find a website for about one firm in fifty — measured on a real search. That is normal: most are sole traders, and a domain cannot be guessed from a person\u2019s name.',
  },
  high: {
    cs: 'Odhadem najdeme web u zhruba každé šesté firmy. Je to odhad podle složení oboru (převažují společnosti s vymyšleným názvem), ne měření.',
    sk: 'Odhadom nájdeme web u zhruba každej šiestej firmy. Je to odhad podľa zloženia odboru (prevažujú spoločnosti s vymysleným názvom), nie meranie.',
    en: 'We expect to find a website for roughly one firm in six. That is an estimate from the make-up of the trade (mostly companies with coined names), not a measurement.',
  },
  mid: {
    cs: 'Odhadem najdeme web u menšiny firem — obor je půl na půl společnosti a živnostníci. Je to odhad podle složení oboru, ne měření.',
    sk: 'Odhadom nájdeme web u menšiny firiem — odbor je pol na pol spoločnosti a živnostníci. Je to odhad podľa zloženia odboru, nie meranie.',
    en: 'We expect a website for a minority of firms — the trade is an even mix of companies and sole traders. An estimate from the make-up of the trade, not a measurement.',
  },
  low: {
    cs: 'Odhadem najdeme web jen u malé části firem — převažují živnostníci se jménem a příjmením, u kterých doménu hádat neumíme. Je to odhad podle složení oboru, ne měření.',
    sk: 'Odhadom nájdeme web len u malej časti firiem — prevažujú živnostníci s menom a priezviskom, u ktorých doménu hádať nevieme. Je to odhad podľa zloženia odboru, nie meranie.',
    en: 'We expect a website for only a small share of firms — mostly sole traders trading under their own name, where we cannot guess a domain. An estimate from the make-up of the trade, not a measurement.',
  },
  // Schválně beze slov: u těchhle oborů NACE kód nesedí natolik, že by i pásmo bylo výmysl.
  unknown: null,
};

/** Pásmo pro obor, jak ho uživatel zadal. Neznámý obor nemá odhad — a nic se nenapíše. */
export function yieldFor(industry: string): YieldBand {
  return resolveNiche(industry).yield ?? 'unknown';
}
