import type { FilterableLead } from './lead-filters';

/**
 * Režim „Ubytování a wellness" (majitel 26. 9. 2026): typ provozu a obec pro vyhledávací odkazy.
 *
 * Všechno se skládá jen z toho, co už o firmě máme — název, kategorie z OpenStreetMap, NACE
 * z ARESu, adresa. Žádné recenze ani hodnocení: Google Places v EHP pro tohle použít nesmíme
 * a Booking ani Airbnb se nečtou. Kdo chce recenze vidět, má u řádku odkaz na vyhledávání.
 *
 * Návrh oslovení podle šablony majitele byl odstraněn 1. 10. 2026 — aplikace je univerzální pro
 * každého, kdo hledá klienty, ne nástroj jednoho prodejce webů.
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
  // 9623 je CZ-NACE 2025, 9604 totéž podle 2008 — RES dává oba.
  ['5510', 'hotel'], ['5520', 'holiday'], ['5530', 'camp_site'], ['5590', 'lodging'], ['9623', 'wellness'], ['9604', 'wellness'],
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
  // Jen převažující činnost (`category`, u ARES z RES; první kód seznamu). Vedlejší deklarované
  // kódy ne — autolakovna s „ubytováním" mezi dvaceti činnostmi penzion není.
  for (const code of [b.category, b.nace?.[0]]) {
    if (!code) continue;
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

/** Města, jejichž části se píšou s pomlčkou („Ostrava-Poruba"). Frýdek-Místek mezi nimi není. */
const CITIES_WITH_DISTRICTS = new Set(['Praha', 'Brno', 'Ostrava', 'Plzeň', 'Liberec', 'Olomouc', 'Pardubice', 'Opava', 'Kladno', 'Ústí nad Labem']);

function clean(obec: string): string {
  // „Praha 4-Nusle", „Brno 12" → Praha, Brno.
  let out = obec.replace(/\s+\d+.*$/, '').trim();
  // „Brno-Královo Pole" → Brno; „Frýdek-Místek" je jedno město a zůstává.
  const [head] = out.split('-');
  if (head !== out && CITIES_WITH_DISTRICTS.has(head)) out = head;
  return out;
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
