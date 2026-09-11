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
 * označená firma má navíc světlý prstenec. I kdyby čtenář dva odstíny zaměnil, pořád ví, jestli
 * firma má web a jestli ji už řešil.
 *
 * Tmavý web: „Osloveno" přešlo z tmavě modré #0072b2 na nebeskou #56b4e9 z téže sady. Tmavá
 * modrá měla na tmavé mapě jen 3,6 : 1 a přes silnici 2,9 : 1, pod hranicí 3 : 1 pro grafiku;
 * nebeská má 8,2 : 1. Jedná se, Klient a Odmítnuto mají i jako text na kartě 5,4 : 1 a víc.
 *
 * „Jedná se" je žlutá #f0e442 z téže sady místo oranžové #e69f00: oranžová patří v celé
 * aplikaci jen bodům bez webu. Od #d55e00 ji rozezná i barvoslepý a na mapě má 14,3 : 1.
 * Akcent UI je světle modrý (#89CFF0) a na mapě se schválně nepoužívá — od „Osloveno"
 * (#56b4e9) se liší jen 1,35 : 1, takže modrá na mapě smí znamenat jedinou věc.
 */
export const LEAD_STATUSES: LeadStatusDef[] = [
  { id: 'new',       label: { cs: 'Neosloveno', sk: 'Neoslovené', en: 'Not contacted' },  color: '#9ca3af' },
  { id: 'contacted', label: { cs: 'Osloveno',   sk: 'Oslovené',   en: 'Contacted' },      color: '#56b4e9' },
  { id: 'talking',   label: { cs: 'Jedná se',   sk: 'Rokuje sa',  en: 'In talks' },       color: '#f0e442' },
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
export type WebState = 'HAS' | 'NONE' | 'UNKNOWN';

export const WEB_COLORS = {
  /**
   * Web jsme ověřili. Šedomodrá schválně: je to ta nezajímavá skupina, nemá strhávat pozornost.
   * Na tmavé mapě 6,5 : 1 (dřívější #64748b měl 4,0 : 1 a přes silnici 3,1 : 1).
   */
  has: '#8b98ab',
  /**
   * Web jsme prověřili a firma ho nemá — to je ta skupina, kvůli které se aplikace otvírá.
   * Jediná oranžová v aplikaci — akcent UI je modrý a „Jedná se" žlutá — takže oranžový
   * kosočtverec na mapě nejde splést s ničím jiným.
   */
  none: '#d55e00',
  /**
   * Nevíme. Tichá: nic netvrdí, jen přiznává, že odpověď chybí. Na světlé mapě to byla bledá
   * #b8b4ae; na tmavé by tatáž barva byla nejjasnější bod ze všech (9,2 : 1). Proto tlumená
   * šedá, která pořád splní 3 : 1 vůči mapě i silnici, ale nekřičí.
   */
  unknown: '#7a7c82',
};

export function pointColor(web: WebState, status: string | null | undefined): string {
  const def = statusDef(status);
  if (def && def.id !== 'new') return def.color;
  if (web === 'HAS') return WEB_COLORS.has;
  return web === 'NONE' ? WEB_COLORS.none : WEB_COLORS.unknown;
}

export type PointShape = 'circle' | 'diamond' | 'ring';

/**
 * Tvar bodu na mapě.
 *
 * Nese jedinou věc, zato tu nejdůležitější: kruh = web ověřen, kosočtverec = prověřili jsme to
 * a firma web nemá, kroužek = nevíme. Drží ji i tehdy, když barvu bodu přebije uživatelská
 * značka — jinak by u označené firmy nešlo z mapy poznat, kvůli čemu se na ni vlastně kliklo.
 * Zároveň je to ten „nebarevný" klíč navíc, díky kterému mapa funguje i pro barvoslepé: tyhle
 * tři tvary se pletou špatně i v odstínech šedi.
 *
 * Třetí tvar přibyl s tím, jak přestalo platit „co není potvrzené, je bez webu": dokud se
 * neověřené firmy kreslily jako kosočtverce, mapa tvrdila o stovkách firem něco, co nikdo
 * nezjišťoval.
 */
export function pointShape(web: WebState): PointShape {
  if (web === 'HAS') return 'circle';
  return web === 'NONE' ? 'diamond' : 'ring';
}

/** Označil si uživatel firmu vlastní značkou? „Neosloveno" je výchozí stav, ne značka. */
export function isTagged(status: string | null | undefined): boolean {
  const def = statusDef(status);
  return Boolean(def && def.id !== 'new');
}

/**
 * Firmy, se kterými už uživatel nemá co dělat.
 *
 * „Jedná se" tu schválně není. Rozjednaná firma je pořád práce — nejcennější ze všech —, takže
 * zmizet z mapy nesmí. Vyřízené je to, co má konec: oslovil jsem (čekám), stal se klientem,
 * odmítl. Právě tyhle body dělají z mapy po pár týdnech nepřehlednou změť, ve které se nová
 * příležitost hledá hůř než na začátku.
 */
export const DONE_STATUSES: LeadStatus[] = ['contacted', 'client', 'rejected'];

const DONE = new Set<string>(DONE_STATUSES);

export function isDone(status: string | null | undefined): boolean {
  return Boolean(status && DONE.has(status));
}
