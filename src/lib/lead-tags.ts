import { localized } from './lead-filters';

/**
 * Kde je uživatel s danou firmou.
 *
 * Je to jediná věc v aplikaci, kterou zapisuje uživatel — všechno ostatní pochází z rejstříků.
 * Proto taky platí jen pro něj: dva lidé můžou mít tutéž firmu v úplně jiné fázi a ani jeden
 * nemá co vidět stav toho druhého (viz model `LeadTag`, klíč je dvojice uživatel + firma).
 *
 * Barvy jsou natvrdo tady, ne v komponentě mapy, protože je potřebuje i seznam a legenda —
 * a tři kopie téhle palety by se dřív nebo později rozešly.
 */

export type LeadStatus = 'new' | 'contacted' | 'talking' | 'client' | 'rejected';

export interface LeadStatusDef {
  id: LeadStatus;
  label: { cs: string; sk?: string; en: string };
  /** Barva bodu na mapě a puntíku v seznamu. */
  color: string;
}

/**
 * Barvy značek jsou z palety Okabe–Ito, která je navržená tak, aby byly její odstíny rozlišitelné
 * i při deuteranopii a protanopii — tedy u zhruba každého dvanáctého muže. Původní sada měla
 * zelenou #16a34a pro klienta a červenou #dc2626 pro nezájem; to je přesně ta dvojice, která se
 * barvoslepému slije v jednu hnědožlutou, a zrovna u „klient" versus „nezájem" je záměna nejdražší.
 *
 * Barva ale nikdy nenese informaci sama: web se pozná podle TVARU bodu (viz `pointShape`) a
 * označená firma má navíc tmavý kroužek. I kdyby čtenář dva odstíny zaměnil, pořád ví, jestli
 * firma má web a jestli ji už řešil.
 */
export const LEAD_STATUSES: LeadStatusDef[] = [
  { id: 'new',       label: { cs: 'Neosloveno', sk: 'Neoslovené', en: 'Not contacted' },  color: '#9ca3af' },
  { id: 'contacted', label: { cs: 'Osloveno',   sk: 'Oslovené',   en: 'Contacted' },      color: '#0072b2' },
  { id: 'talking',   label: { cs: 'Jedná se',   sk: 'Rokuje sa',  en: 'In talks' },       color: '#e69f00' },
  { id: 'client',    label: { cs: 'Klient',     sk: 'Klient',     en: 'Client' },         color: '#009e73' },
  { id: 'rejected',  label: { cs: 'Nezájem',    sk: 'Nezáujem',   en: 'Not interested' }, color: '#cc79a7' },
];

const BY_ID = new Map(LEAD_STATUSES.map(s => [s.id, s]));

export const LEAD_STATUS_IDS = LEAD_STATUSES.map(s => s.id);

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === 'string' && BY_ID.has(value as LeadStatus);
}

export function statusDef(id: string | null | undefined): LeadStatusDef | undefined {
  return id ? BY_ID.get(id as LeadStatus) : undefined;
}

export function statusLabel(id: string | null | undefined, locale: string): string | null {
  const def = statusDef(id);
  return def ? localized(def.label, locale) : null;
}

/**
 * Barva bodu na mapě.
 *
 * Bez značky rozhoduje web — to je celý smysl té mapy. Jakmile ale uživatel firmu označí,
 * vyhrává jeho vlastní stav: v tu chvíli ho zajímá, koho už řešil, ne kdo má web.
 */
export const WEB_COLORS = {
  /** Web jsme ověřili. Šedá schválně: je to ta nezajímavá skupina, nemá strhávat pozornost. */
  has: '#64748b',
  /** Web jsme nenašli — to je ta skupina, kvůli které se aplikace otvírá. */
  none: '#d55e00',
};

export function pointColor(hasWebsite: boolean, status: string | null | undefined): string {
  const def = statusDef(status);
  if (def && def.id !== 'new') return def.color;
  return hasWebsite ? WEB_COLORS.has : WEB_COLORS.none;
}

export type PointShape = 'circle' | 'diamond';

/**
 * Tvar bodu na mapě.
 *
 * Tvar nese jedinou věc: má firma web, nebo jsme ho nenašli. Drží ji i tehdy, když barvu bodu
 * přebije uživatelská značka — jinak by u označené firmy nešlo z mapy poznat, kvůli čemu se na
 * ni vlastně kliklo. Zároveň je to ten „nebarevný" klíč navíc, díky kterému mapa funguje i pro
 * barvoslepé: kruh a kosočtverec se pletou špatně i v odstínech šedi.
 */
export function pointShape(hasWebsite: boolean): PointShape {
  return hasWebsite ? 'circle' : 'diamond';
}

/** Označil si uživatel firmu vlastní značkou? „Neosloveno" je výchozí stav, ne značka. */
export function isTagged(status: string | null | undefined): boolean {
  const def = statusDef(status);
  return Boolean(def && def.id !== 'new');
}
