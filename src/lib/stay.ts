import { SOLE_TRADER_FORMS, webStatusOf, type FilterableLead } from './lead-filters';

/**
 * Režim „Ubytování a wellness" (majitel 26. 9. 2026): typ provozu, obec a návrh oslovení.
 *
 * Všechno se skládá jen z toho, co už o firmě máme — název, kategorie z OpenStreetMap, NACE
 * z ARESu, adresa. Žádné recenze ani hodnocení: Google Places v EHP pro tohle použít nesmíme
 * a Booking ani Airbnb se nečtou. Kdo chce recenze vidět, má u řádku odkaz na vyhledávání.
 *
 * Návrh oslovení se jen ukáže k úpravě. Nic se neodesílá — uživatel si text zkopíruje nebo
 * otevře jako koncept ve svém e-mailu.
 */

/** Obory, které režim zapíná. `hotel` je ubytování (slug zůstal kvůli uloženým hledáním). */
export const STAY_INDUSTRIES = ['hotel', 'wellness'] as const;

export interface StayLead extends FilterableLead {
  name: string;
}

export interface StayKind {
  key: string;
  /** Odkud typ víme. `nace` je jen deklarace v rejstříku — provoz jsme neověřili a UI to říká. */
  from?: 'name' | 'osm' | 'nace';
  /** Do věty „Dělám weby pro {typ}" — 4. pád množného čísla. */
  plural: string;
  /** Krátce na řádek a do exportu. */
  label: string;
}

const KINDS: Record<string, StayKind> = {
  guest_house: { key: 'guest_house', plural: 'penziony', label: 'Penzion' },
  apartment:   { key: 'apartment', plural: 'apartmány', label: 'Apartmány' },
  chalet:      { key: 'chalet', plural: 'chaty a chalupy', label: 'Chata / chalupa' },
  glamping:    { key: 'glamping', plural: 'glampingy', label: 'Glamping' },
  camp_site:   { key: 'camp_site', plural: 'kempy', label: 'Kemp' },
  hotel:       { key: 'hotel', plural: 'hotely a penziony', label: 'Hotel' },
  motel:       { key: 'motel', plural: 'motely', label: 'Motel' },
  hostel:      { key: 'hostel', plural: 'hostely', label: 'Hostel' },
  alpine_hut:  { key: 'alpine_hut', plural: 'horské chaty', label: 'Horská chata' },
  wellness:    { key: 'wellness', plural: 'privátní wellness a sauny', label: 'Wellness / sauna' },
  massage:     { key: 'massage', plural: 'masážní salony', label: 'Masáže' },
  lodging:     { key: 'lodging', plural: 'ubytování', label: 'Ubytování' },
  holiday:     { key: 'holiday', plural: 'rekreační ubytování', label: 'Rekreační ubytování' },
};

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Podle názvu — nejkonkrétnější, co máme: „Penzion U Lípy" je penzion, ať deklaruje cokoli. */
const BY_NAME: Array<[RegExp, string]> = [
  [/glamping/, 'glamping'],
  [/penzion|pension/, 'guest_house'],
  [/apartm/, 'apartment'],
  [/\bchat[ay]\b|chalup|\bsrub|roubenk/, 'chalet'],
  [/autokemp|\bkemp|camping/, 'camp_site'],
  [/hostel/, 'hostel'],
  [/motel/, 'motel'],
  [/hotel/, 'hotel'],
  [/wellness|sauna|virivk|whirlpool|\bspa\b|lazne/, 'wellness'],
  [/masaz/, 'massage'],
  [/ubytovan/, 'lodging'],
];

/** Tag z OpenStreetMap (`category` řádku) → typ. */
const BY_OSM: Record<string, string> = {
  guest_house: 'guest_house', apartment: 'apartment', chalet: 'chalet', camp_site: 'camp_site',
  hotel: 'hotel', motel: 'motel', hostel: 'hostel', alpine_hut: 'alpine_hut',
  sauna: 'wellness', hot_tub: 'wellness', massage: 'massage',
};

/** NACE z ARESu / RES; kódy ukládají v různé hloubce, proto prefix. */
const BY_NACE: Array<[string, string]> = [
  ['5510', 'hotel'], ['5520', 'holiday'], ['5530', 'camp_site'], ['5590', 'lodging'], ['9623', 'wellness'],
];

/** Poznal se typ z názvu? Když ne, název je často jméno a příjmení živnostníka. */
function kindFromName(b: StayLead): StayKind | null {
  const name = fold(b.name ?? '');
  for (const [re, key] of BY_NAME) if (re.test(name)) return { ...KINDS[key], from: 'name' };
  return null;
}

/** Firma v likvidaci nic nového nestaví — oslovovat ji nemá smysl. */
const LIQUIDATION = /v\s+likvidaci/i;

/** Typ provozu, nebo null — pak firma do režimu nepatří a oslovení se nenabízí. */
export function stayKind(b: StayLead): StayKind | null {
  if (LIQUIDATION.test(b.name ?? '')) return null;
  const fromName = kindFromName(b);
  if (fromName) return fromName;
  const osm = b.category ? BY_OSM[b.category] : undefined;
  if (osm) return { ...KINDS[osm], from: 'osm' };
  for (const code of b.nace ?? []) {
    const hit = BY_NACE.find(([prefix]) => code.startsWith(prefix));
    if (hit) return { ...KINDS[hit[1]], from: 'nace' };
  }
  return null;
}

/**
 * Přednost v pořadí režimu: provoz poznaný z názvu nebo z mapy (penzion, apartmány, sauna)
 * před firmou, která ubytování jen deklaruje v NACE. Bez toho vedly seznam akciovky a spolky
 * s kódem 55100 mezi dvaceti jinými (změřeno v Liberci 26. 9. 2026), protože mají DPH a léta.
 */
export function stayRankBonus(b: StayLead): number {
  const kind = stayKind(b);
  if (!kind) return 0;
  return kind.from === 'nace' ? 0 : 20;
}

/** Nálepka na řádek a do exportu; u typu jen z NACE to přizná. */
export function stayKindLabel(kind: StayKind): string {
  return kind.from === 'nace' ? `${kind.label} (NACE)` : kind.label;
}

/** Název do věty bez právní formy: „Penzion Horský dvůr s.r.o." → „Penzion Horský dvůr". */
export function plainName(name: string): string {
  return name
    .replace(/,?\s*(spol\.\s*s\s*r\.\s*o\.|s\.\s*r\.\s*o\.|a\.\s*s\.|v\.\s*o\.\s*s\.|k\.\s*s\.|z\.\s*s\.|o\.\s*p\.\s*s\.)\s*$/i, '')
    .trim();
}

/**
 * Obec z adresy. ARES píše „Ruská 99/164, 41701 Dubí" nebo „Náměstí 5, 760 01 Zlín",
 * OpenStreetMap „Ulice 12, Zlín, 76001". Číslo městské části („Praha 2", „Brno 12") pryč.
 */
export function obecFromAddress(address: string | null | undefined): string {
  if (!address) return '';
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const withZip = /^\d{3}\s?\d{2}\s+(.+)$/.exec(parts[i]);
    if (withZip) return clean(withZip[1]);
  }
  // Bez PSČ před názvem: poslední část, která není jen PSČ a nezačíná číslem popisným.
  for (let i = parts.length - 1; i >= 1; i--) {
    if (!/^\d[\d\s]*$/.test(parts[i]) && !/\d+\/?\d*\s*$/.test(parts[i])) return clean(parts[i]);
  }
  return '';
}

function clean(obec: string): string {
  // „Praha 4-Nusle", „Brno 12" → Praha, Brno.
  let out = obec.replace(/\s+\d+.*$/, '').trim();
  // „Brno-Královo Pole" → Brno; „Frýdek-Místek" je jedno město a zůstává.
  const [head] = out.split('-');
  if (head !== out && LOCATIVE[head] && !LOCATIVE[out]) out = head;
  return out;
}

/**
 * „v Praze", „ve Zlíně", „na Kladně". Česká jména obcí se skloňují nepravidelně, takže slovník
 * pro krajská a turistická místa, pár spolehlivých koncovek, a jinak „v obci X" — to je vždy
 * gramaticky správně. Zpráva je stejně jen návrh k úpravě.
 */
const LOCATIVE: Record<string, string> = {
  'Praha': 'v Praze', 'Brno': 'v Brně', 'Ostrava': 'v Ostravě', 'Plzeň': 'v Plzni', 'Liberec': 'v Liberci',
  'Olomouc': 'v Olomouci', 'České Budějovice': 'v Českých Budějovicích', 'Hradec Králové': 'v Hradci Králové',
  'Ústí nad Labem': 'v Ústí nad Labem', 'Pardubice': 'v Pardubicích', 'Zlín': 've Zlíně', 'Jihlava': 'v Jihlavě',
  'Karlovy Vary': 'v Karlových Varech', 'Kladno': 'na Kladně', 'Most': 'v Mostě', 'Opava': 'v Opavě',
  'Frýdek-Místek': 've Frýdku-Místku', 'Karviná': 'v Karviné', 'Teplice': 'v Teplicích', 'Děčín': 'v Děčíně',
  'Jablonec nad Nisou': 'v Jablonci nad Nisou', 'Mladá Boleslav': 'v Mladé Boleslavi', 'Třebíč': 'v Třebíči',
  'Tábor': 'v Táboře', 'Znojmo': 've Znojmě', 'Cheb': 'v Chebu', 'Písek': 'v Písku', 'Kroměříž': 'v Kroměříži',
  'Uherské Hradiště': 'v Uherském Hradišti', 'Český Krumlov': 'v Českém Krumlově', 'Mariánské Lázně': 'v Mariánských Lázních',
  'Františkovy Lázně': 've Františkových Lázních', 'Luhačovice': 'v Luhačovicích', 'Špindlerův Mlýn': 've Špindlerově Mlýně',
  'Pec pod Sněžkou': 'v Peci pod Sněžkou', 'Rokytnice nad Jizerou': 'v Rokytnici nad Jizerou', 'Lipno nad Vltavou': 'v Lipně nad Vltavou',
  'Frymburk': 've Frymburku', 'Lednice': 'v Lednici', 'Valtice': 've Valticích', 'Třeboň': 'v Třeboni', 'Telč': 'v Telči',
  'Kutná Hora': 'v Kutné Hoře', 'Karolinka': 'v Karolince', 'Velké Karlovice': 've Velkých Karlovicích',
  'Železná Ruda': 'v Železné Rudě', 'Kvilda': 'na Kvildě', 'Horní Planá': 'v Horní Plané', 'Poděbrady': 'v Poděbradech',
  'Jeseník': 'v Jeseníku', 'Janské Lázně': 'v Janských Lázních', 'Desná': 'v Desné', 'Trutnov': 'v Trutnově',
  'Vrchlabí': 've Vrchlabí', 'Jičín': 'v Jičíně', 'Kopřivnice': 'v Kopřivnici', 'Mohelnice': 'v Mohelnici',
  'Roudnice nad Labem': 'v Roudnici nad Labem', 'Strakonice': 've Strakonicích', 'Klatovy': 'v Klatovech',
  'Domažlice': 'v Domažlicích', 'Sušice': 'v Sušici', 'Prachatice': 'v Prachaticích', 'Náchod': 'v Náchodě',
  'Litomyšl': 'v Litomyšli', 'Svitavy': 've Svitavách', 'Semily': 'v Semilech', 'Turnov': 'v Turnově',
};

const PREPOSITIONS = new Set(['pod', 'nad', 'na', 'u', 'v', 've', 'při']);

function withPreposition(loc: string): string {
  return /^[vfVF]/.test(loc) || /^[szšžSZŠŽ][^aeiouyáéíóúůýěAEIOUYÁÉÍÓÚŮÝĚ]/.test(loc) ? `ve ${loc}` : `v ${loc}`;
}

export function inObec(obec: string): string {
  if (!obec) return '';
  if (LOCATIVE[obec]) return LOCATIVE[obec];
  const [first, ...rest] = obec.split(' ');
  // Víceslovné jen tehdy, když zbytek je „pod X", „nad X" — to se neskloňuje. „Nové Město" ne.
  if (rest.length && !PREPOSITIONS.has(rest[0])) return `v obci ${obec}`;
  const tail = rest.length ? ` ${rest.join(' ')}` : '';
  const rules: Array<[RegExp, string]> = [[/ovice$/, 'ovicích'], [/any$/, 'anech'], [/ov$/, 'ově'], [/ín$/, 'íně'], [/ec$/, 'ci']];
  for (const [re, rep] of rules) if (re.test(first)) return withPreposition(first.replace(re, rep) + tail);
  return `v obci ${obec}`;
}

/** Věta podle toho, co o webu víme. Null, když web mají — šablona je pro ty, kdo ho nemají. */
export function detailSentence(b: StayLead): string | null {
  if (webStatusOf(b) === 'HAS') return null;
  const fb = Boolean(b.hasFacebook);
  const ig = Boolean(b.hasInstagram);
  if (fb || ig) {
    if (fb && ig) return 'Všiml jsem si, že máte jen Facebook a Instagram, ale vlastní web, kde by si hosté mohli zarezervovat napřímo, chybí.';
    return `Všiml jsem si, že máte jen ${fb ? 'Facebook' : 'Instagram'} a vlastní web, kde by si hosté mohli zarezervovat napřímo, chybí.`;
  }
  return 'Nenašel jsem, že byste měli vlastní web, kde by si hosté mohli zarezervovat napřímo.';
}

/** Návrh zprávy podle šablony majitele. Null, když firma do režimu nepatří nebo web má. */
export function outreachMessage(b: StayLead, fallbackObec = ''): string | null {
  const kind = stayKind(b);
  const detail = detailSentence(b);
  if (!kind || !detail) return null;
  const obec = obecFromAddress(b.address) || fallbackObec;
  const where = obec ? ` ${inObec(obec)}` : '';
  /**
   * Živnostník vede ubytování pod svým jménem a „narazil jsem na Jan Novák" je špatně česky
   * (a skloňovat cizí jména automaticky nejde). Když typ neprozradil název, ale NACE nebo mapa,
   * a jde o živnostníka, mluví se o provozu: „narazil jsem na vaše ubytování".
   */
  const personal = !kindFromName(b) && Boolean(b.legalForm) && SOLE_TRADER_FORMS.includes(b.legalForm!);
  const subject = personal
    ? (kind.key === 'massage' ? 'váš masážní salon' : kind.key === 'wellness' ? 'vaše wellness' : 'vaše ubytování')
    : plainName(b.name);
  return [
    'Dobrý den,',
    `narazil jsem na ${subject}${where}. ${detail}`,
    'Každá rezervace přes Booking stojí provizi, obvykle kolem 15 %. U hostů, kteří se vracejí nebo vás doporučí, je škoda ji platit znovu a znovu.',
    `Dělám weby pro ${kind.plural} s rezervacemi a platbou kartou přímo na webu. Kalendář se propojí s Bookingem i Airbnb, takže se nic nepřekryje.`,
    'Mám vám nachystat nezávazný návrh, jak by to u vás mohlo vypadat?',
    'Kristián',
    'webovkyvanek.cz',
  ].join('\n');
}

/** Vyhledávací odkazy pro ruční kontrolu recenzí. Jen URL — nic se nestahuje ani neukládá. */
export function googleSearchHref(b: StayLead): string {
  const q = [b.name, obecFromAddress(b.address)].filter(Boolean).join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

export function mapyCzHref(b: StayLead): string {
  const q = [b.name, obecFromAddress(b.address)].filter(Boolean).join(' ');
  return `https://mapy.cz/zakladni?q=${encodeURIComponent(q)}`;
}
