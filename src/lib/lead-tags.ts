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

export const LEAD_STATUSES: LeadStatusDef[] = [
  { id: 'new',       label: { cs: 'Neosloveno', sk: 'Neoslovené', en: 'Not contacted' }, color: '#9ca3af' },
  { id: 'contacted', label: { cs: 'Osloveno',   sk: 'Oslovené',   en: 'Contacted' },     color: '#2563eb' },
  { id: 'talking',   label: { cs: 'Jedná se',   sk: 'Rokuje sa',  en: 'In talks' },      color: '#d97706' },
  { id: 'client',    label: { cs: 'Klient',     sk: 'Klient',     en: 'Client' },        color: '#16a34a' },
  { id: 'rejected',  label: { cs: 'Nezájem',    sk: 'Nezáujem',   en: 'Not interested' }, color: '#dc2626' },
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
  /** Web jsme ověřili. */
  has: '#94a3b8',
  /** Web jsme nenašli — to je ta skupina, kvůli které se aplikace otvírá. */
  none: '#ea580c',
};

export function pointColor(hasWebsite: boolean, status: string | null | undefined): string {
  const def = statusDef(status);
  if (def && def.id !== 'new') return def.color;
  return hasWebsite ? WEB_COLORS.has : WEB_COLORS.none;
}
