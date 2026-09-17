/**
 * Every filter the app offers, as data.
 *
 * The old filters were `if (filter === 'x') where.y = z` branches in the results route plus a
 * second, hand-kept copy of the same logic in the search page. Two copies of a rule is one copy
 * too many, and adding a filter meant editing both.
 *
 * Here a filter is one object with two renderings of the same question: `where` for rows that
 * are still in the database, `test` for rows already loaded in the browser. Adding one is
 * adding an entry — no route and no component changes.
 *
 * The important part for the future: filters ask about *fields*, never about sources. A new
 * source that fills in `phone` immediately improves "bez kontaktu" without anyone touching
 * this file.
 *
 * These filters are also the vocabulary the scoring uses: a user picks the ones that describe
 * their ideal client and `lib/lead-score.ts` counts how many of them a firm meets. That is why
 * the two shared primitives below live here and not there — the dependency runs one way,
 * lead-score → lead-filters, and never back.
 */
import { isAllIndustries } from './industries';

export function yearsSince(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

/** The subset of a result row the client-side predicates need. */
export interface FilterableLead {
  websiteStatus?: string | null;
  hasWebsite?: boolean | null;
  /** Adresa ověřeného webu. Protokol v ní je jediný zdroj informace o HTTPS — nikde jinde ho nemáme. */
  website?: string | null;
  /** Stránka „Kontakt" na webu firmy, přečtená z odkazu na její vlastní homepage. */
  contactUrl?: string | null;
  websiteIsOld?: boolean | null;
  phone?: string | null;
  email?: string | null;
  category?: string | null;
  address?: string | null;
  foundedAt?: Date | string | null;
  vatPayer?: boolean | null;
  vatUnreliable?: boolean | null;
  hasFacebook?: boolean | null;
  hasInstagram?: boolean | null;
  hasLinkedIn?: boolean | null;
  /**
   * True when we actually had a page to read the social links off. Three `false`s on a row we
   * never opened mean "we did not look", not "the firm has no profiles".
   */
  socialsChecked?: boolean | null;
  /** Kód právní formy z ARESu. `112` s.r.o., `101` živnostník, `121` a.s. … */
  legalForm?: string | null;
  /** Počet provozoven s aktivním živnostenským oprávněním. NULL = nezeptali jsme se. */
  activePremises?: number | null;
  /** Které zdroje o firmě věděly, spojené plusem: `ares`, `osm`, `ares+osm`. */
  source?: string | null;
  /** Kategorie počtu pracovníků z RES (kód ČSÚ). `000` i NULL = neuvedeno, třetí stav. */
  employeeCategory?: string | null;
  /** ARES: subjekt je v insolvenčním rejstříku. NULL = neptali jsme se. */
  inInsolvency?: boolean | null;
  nace?: string[] | null;
  registryUpdatedAt?: Date | string | null;
  /** Inzerent z Meta Knihovny reklam spárovaný s firmou. NULL = nespárováno, ne „neinzeruje". */
  adsPageId?: string | null;
  adsSince?: Date | string | null;
  adsCount?: number | null;
  /** Doména, kam reklamy vedou. NULL u spárované firmy = reklamy nevedou na web. */
  adsLinkDomain?: string | null;
  adsReach?: number | null;
}

/** Zdroj, o který se filtr opírá — vypisuje se u každého doložení. */
export type FilterSource = 'ARES' | 'RŽP' | 'RES' | 'MFČR' | 'OSM' | 'web' | 'Meta';

const DATE_LOCALE: Record<string, string> = { cs: 'cs-CZ', sk: 'sk-SK', en: 'en-GB' };
function fmtDate(value: Date | string | null | undefined, locale: string): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(DATE_LOCALE[locale] ?? 'cs-CZ');
}

/** Kategorie počtu pracovníků ČSÚ (RES) → text. `000`/NULL = neuvedeno, schválně ne nula. */
export const EMPLOYEE_CATEGORY: Record<string, { cs: string; sk?: string; en: string }> = {
  '110': { cs: 'bez zaměstnanců', sk: 'bez zamestnancov', en: 'no employees' },
  '120': { cs: '1–5 zaměstnanců', sk: '1–5 zamestnancov', en: '1–5 employees' },
  '130': { cs: '6–9 zaměstnanců', sk: '6–9 zamestnancov', en: '6–9 employees' },
  '210': { cs: '10–19 zaměstnanců', sk: '10–19 zamestnancov', en: '10–19 employees' },
  '220': { cs: '20–24 zaměstnanců', sk: '20–24 zamestnancov', en: '20–24 employees' },
  '230': { cs: '25–49 zaměstnanců', sk: '25–49 zamestnancov', en: '25–49 employees' },
  '240': { cs: '50–99 zaměstnanců', sk: '50–99 zamestnancov', en: '50–99 employees' },
  '310': { cs: '100–199 zaměstnanců', sk: '100–199 zamestnancov', en: '100–199 employees' },
  '320': { cs: '200–249 zaměstnanců', sk: '200–249 zamestnancov', en: '200–249 employees' },
  '330': { cs: '250–499 zaměstnanců', sk: '250–499 zamestnancov', en: '250–499 employees' },
  '340': { cs: '500–999 zaměstnanců', sk: '500–999 zamestnancov', en: '500–999 employees' },
};
export function employeeLabel(code: string | null | undefined, locale: string): string {
  const known = code ? EMPLOYEE_CATEGORY[code] : undefined;
  if (known) return localized(known, locale);
  if (code && /^[45]\d\d$/.test(code)) return localized({ cs: '1000+ zaměstnanců', sk: '1000+ zamestnancov', en: '1000+ employees' }, locale);
  return localized({ cs: 'počet zaměstnanců neuveden', sk: 'počet zamestnancov neuvedený', en: 'employee count not stated' }, locale);
}
/** Známá hodnota = cokoli kromě NULL a `000`. */
export function employeesKnown(b: FilterableLead): boolean {
  return Boolean(b.employeeCategory && b.employeeCategory !== '000');
}

/**
 * Skupiny podle toho, co uživatel řeší, ne podle toho, odkud data jsou:
 * kdo to je · co se u ní stalo · jak na tom je · jak ji oslovit.
 */
export type FilterGroup = 'who' | 'event' | 'standing' | 'reach';

export type FilterScope = 'index' | 'row';
export const SCOPE_TEXT: Record<FilterScope, { title: { cs: string; sk?: string; en: string }; note: { cs: string; sk?: string; en: string } }> = {
  index: {
    title: { cs: 'Zužuje výběr', sk: 'Zužuje výber', en: 'Narrows the search' },
    note:  { cs: 'Hledá se v celém kraji z indexu ČSÚ, výsledek je úplný (firmy do 5 let od vzniku). Čísla u voleb říkají, kolik firem podmínce odpovídá.',
             sk: 'Hľadá sa v celom kraji z indexu ČSÚ, výsledok je úplný (firmy do 5 rokov od vzniku). Čísla pri voľbách hovoria, koľko firiem podmienke zodpovedá.',
             en: 'Searches the whole region from the CZSO index; the result is complete (firms up to 5 years old). The numbers say how many firms match.' },
  },
  row: {
    title: { cs: 'Prořezává nalezené', sk: 'Prerezáva nájdené', en: 'Prunes what was found' },
    note:  { cs: 'Ověřuje se u každé stažené firmy. Nechá jen ty z nalezených, které podmínku splní — celý kraj neprohledá a počet dopředu neznáme.',
             sk: 'Overuje sa pri každej stiahnutej firme. Nechá len tie z nájdených, ktoré podmienku splnia — celý kraj neprehľadá a počet vopred nepoznáme.',
             en: 'Checked on every downloaded firm. Keeps only those found that pass — it does not search the whole region and the count is not known in advance.' },
  },
};
export const scopeOf = (f: { scope?: FilterScope }): FilterScope => f.scope ?? 'row';

/**
 * Slovak falls back to Czech rather than English. Every label here is understood by a Slovak
 * reader, and a half-Slovak half-English screen looks broken in a way half-Czech does not.
 */
export function localized(text: { cs: string; sk?: string; en: string }, locale: string): string {
  if (locale === 'en') return text.en;
  if (locale === 'sk') return text.sk ?? text.cs;
  return text.cs;
}

export interface LeadFilter {
  id: string;
  group: FilterGroup;
  label: { cs: string; sk?: string; en: string };
  /** Prisma `BusinessResultWhereInput`, typed loosely so this module stays Prisma-free. */
  where: Record<string, unknown>;
  test: (b: FilterableLead) => boolean;
  /**
   * True when the data this filter asks about is simply missing for this row — "we did not
   * learn", as opposed to `test` returning false, which means "we learned it, and it is no".
   *
   * Only the *scoring* reads this (see `lead-score.ts`); filtering ignores it entirely, because
   * a chip the user clicked must keep meaning "show me rows that pass `test`, full stop".
   *
   * It matters because our two sources know disjoint things. OpenStreetMap carries the phones
   * and e-mails but has never heard of a founding date; ARES is the other way round. Without
   * this flag, an accountant who picks "nová firma" scores every OSM row as a confirmed miss,
   * the ceiling drops to 50, and the "call these first" highlight never fires once.
   *
   * Absent means "this filter is always answerable" — most are, because an empty `phone` column
   * really is the answer.
   */
  unknown?: (b: FilterableLead) => boolean;
  /**
   * Věta pod skupinou filtrů a bublina na chipu. Má ji jen to, co samotný popisek řekne
   * nepřesně — hlavně trojice kolem webu, kde si „Web nemá" každý přečte jako hlavní funkci
   * aplikace, a přitom je to ten nejvzácnější ze tří stavů.
   */
  hint?: { cs: string; sk?: string; en: string };
  /** Typ ovládání. Dnes jen `bool` (chip); `select` a `range` přijdou s indexem (etapa 3). */
  kind?: 'bool' | 'select' | 'range' | 'date';
  /** Odkud filtr bere odpověď. */
  source?: FilterSource;
  /**
   * Kde filtr působí — a to je pro uživatele ta nejdůležitější informace o něm.
   *
   *  - `index`  zužuje výběr PŘED stahováním: pole jsou v indexu ČSÚ (kraj, okres, právní forma,
   *             NACE, vznik, zaměstnanci), takže hledání projde celý kraj a výsledek je úplný
   *             (v okně indexu, viz `REGISTRY_INDEX_MONTHS`). Index umí spočítat, kolik firem
   *             podmínce odpovídá, ještě než se něco spustí.
   *  - `row`    prořezává nalezené: zjišťuje se u každé stažené firmy (DPH, insolvence, web,
   *             telefon, e-mail…). Nechá jen ty z nalezených, které podmínku splní — celý kraj
   *             neprohledá a počet dopředu nikdo nezná.
   *
   * Bez hodnoty = `row`. UI obě skupiny kreslí zvlášť a druhé píše větu o tom, co dělá; jinak
   * by si uživatel myslel, že „neplátce DPH v kraji" prohledal kraj, když jen profiltroval
   * pět set stažených firem.
   */
  scope?: FilterScope;
  /**
   * Čím se filtr u téhle firmy opírá — krátký text pro řádek výsledku, např. „vznik 14. 9. 2026 ·
   * ARES". Když důkaz není (data chybí), vrací null a UI nic netvrdí. Poučení z detekce webu:
   * filtr nesmí říkat nic, co nedokáže doložit.
   */
  evidence?: (b: FilterableLead, locale: string) => string | null;
}

export const GROUP_LABELS: Record<FilterGroup, { cs: string; sk?: string; en: string }> = {
  who:      { cs: 'Kdo to je',     sk: 'Kto to je',      en: 'Who they are' },
  event:    { cs: 'Co se stalo',   sk: 'Čo sa stalo',    en: 'What happened' },
  standing: { cs: 'Jak na tom je', sk: 'Ako na tom je',  en: 'How they stand' },
  reach:    { cs: 'Jak oslovit',   sk: 'Ako osloviť',    en: 'How to reach' },
};

export const GROUP_ORDER: FilterGroup[] = ['who', 'event', 'standing', 'reach'];

/**
 * Rows written before three-state classification carry no status; their `hasWebsite: false`
 * was never evidence of anything, so they read as UNKNOWN.
 */
export function webStatusOf(b: FilterableLead): 'HAS' | 'NONE' | 'UNKNOWN' {
  if (b.websiteStatus === 'HAS' || b.websiteStatus === 'NONE' || b.websiteStatus === 'UNKNOWN') {
    return b.websiteStatus;
  }
  return b.hasWebsite ? 'HAS' : 'UNKNOWN';
}

/** Same fallback as `webStatusOf`, expressed for the database. */
const STATUS_HAS = {
  OR: [{ websiteStatus: 'HAS' }, { websiteStatus: null, hasWebsite: true }],
};
/** Everything we could not confirm a website for — the unproven and the proven-absent alike. */
const STATUS_NOT_HAS = { NOT: STATUS_HAS };

function hasSocial(b: FilterableLead): boolean {
  return Boolean(b.hasFacebook || b.hasInstagram || b.hasLinkedIn);
}

/**
 * Existuje aspoň jedna cesta, jak firmu oslovit?
 *
 * Primitivum sdílí filtr `can_reach` a skóre dosažitelnosti (`lib/reach-score.ts`). Bydlí tady,
 * aby závislost mířila jedním směrem — reach-score → lead-filters — a nevznikl kruh.
 */
export function hasReachChannel(b: FilterableLead): boolean {
  return Boolean(b.phone || b.email || b.contactUrl || hasSocial(b)) || webStatusOf(b) === 'HAS';
}

/**
 * Právní formy, které nejsou fyzická osoba.
 *
 * `100` a `101` jsou podnikající fyzická osoba — všechno ostatní je právnická osoba, tedy někdo,
 * kdo za založení zaplatil a každý rok podává účetní závěrku. Test je proto „není OSVČ" a ne
 * výčet forem: číselník ARESu má přes sto položek a nový spolek nebo evropská společnost nemá
 * propadnout sítem jen proto, že jsme na ni zapomněli.
 */
export const SOLE_TRADER_FORMS = ['100', '101'];

function isCompany(b: FilterableLead): boolean {
  return Boolean(b.legalForm) && !SOLE_TRADER_FORMS.includes(b.legalForm!);
}

/** Provozovna s aktivním živnostenským oprávněním. `null` znamená, že jsme se nezeptali. */
function hasActivePremises(b: FilterableLead): boolean {
  return typeof b.activePremises === 'number' && b.activePremises > 0;
}

/**
 * Firmu někdo ručně zanesl do OpenStreetMap.
 *
 * Je to nejsilnější důkaz provozu, jaký máme: mapér u toho podniku fyzicky stál. Zároveň jsou
 * to jediné řádky, které nesou telefon a e-mail — ARES kontakty nemá. Bez téhle větve by je
 * filtr smetl, protože nemají IČO, a tím pádem ani provozovny, DPH a právní formu, na které
 * se ptá zbytek pravidla.
 */
function isMapped(b: FilterableLead): boolean {
  return (b.source ?? '').split('+').includes('osm');
}

function olderThan(years: number) {
  return (b: FilterableLead) => {
    const age = yearsSince(b.foundedAt);
    return age !== null && age >= years;
  };
}

/** `foundedAt` before this instant means the firm is at least `years` old. */
function foundedBefore(years: number): Date {
  return new Date(Date.now() - years * 365.25 * 24 * 60 * 60 * 1000);
}

function youngerThan(years: number) {
  return (b: FilterableLead) => {
    const age = yearsSince(b.foundedAt);
    return age !== null && age < years;
  };
}

function foundedDaysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
function youngerThanDays(days: number) {
  return (b: FilterableLead) => {
    const age = yearsSince(b.foundedAt);
    return age !== null && age * 365.25 < days;
  };
}

/**
 * Filtry podle vzniku hledají jinak než ostatní: přes index z ČSÚ (etapa 3), který umí datum
 * i celý kraj, a jméno firmy se pak dohledá v ARESu. Jedna věta pod skupinou to říká.
 */
// Šance na kontakt je změřená (14. 9. 2026, 300 nových firem): telefon nebo e-mail u 11 % všech,
// u obchodních společností 19 %, u živnostníků v dopravě 3 %. Píše se míň, než vyšlo.
const META_HINT = {
  cs: 'Z Meta Knihovny reklam (bezplatné API, v EU jsou veřejné všechny reklamy z posledního roku). Firma se s inzerentem páruje podle domény webu nebo názvu — nespárovaná firma neznamená, že neinzeruje. Cílovou adresu reklamy API nedává; ví se jen, jestli reklama vede na nějaký web.',
  sk: 'Z Meta Knižnice reklám (bezplatné API, v EÚ sú verejné všetky reklamy z posledného roka). Firma sa s inzerentom páruje podľa domény webu alebo názvu — nespárovaná firma neznamená, že neinzeruje. Cieľovú adresu reklamy API nedáva; vie sa len, či reklama vedie na nejaký web.',
  en: 'From the Meta Ad Library (free API; in the EU every ad from the last year is public). A firm is matched to an advertiser by website domain or name — an unmatched firm does not mean it does not advertise. The API gives no landing URL; only whether an ad links to some website.',
};

/** „inzeruje na Meta od 4. 3. 2026 · 3 reklamy · Knihovna reklam" */
function adsEvidence(b: FilterableLead, l: string): string | null {
  if (!b.adsPageId) return null;
  const n = b.adsCount ?? 0;
  const d = fmtDate(b.adsSince, l);
  const ads = l === 'en' ? `${n} ${n === 1 ? 'ad' : 'ads'}` : `${n} ${n === 1 ? 'reklama' : n < 5 ? 'reklamy' : 'reklam'}`;
  const since = d ? (l === 'en' ? ` since ${d}` : ` od ${d}`) : '';
  return localized({ cs: `inzeruje na Meta${since} · ${ads} · Knihovna reklam`, sk: `inzeruje na Meta${since} · ${ads} · Knižnica reklám`, en: `advertises on Meta${since} · ${ads} · Ad Library` }, l);
}

const REGISTRY_HINT = {
  cs: 'Firmy podle data vzniku hledáme v indexu z RES ČSÚ — v celém kraji, ne jen v krajském městě. Jméno a sídlo doplní ARES. Index se obnovuje dvakrát měsíčně. Telefon nebo e-mail se u nové firmy dohledá zhruba u každé desáté, u obchodních společností asi u každé páté — zbytek ještě žádný web ani mapový záznam nemá.',
  sk: 'Firmy podľa dátumu vzniku hľadáme v indexe z RES ČSÚ — v celom kraji, nie len v krajskom meste. Meno a sídlo doplní ARES. Index sa obnovuje dvakrát mesačne. Telefón alebo e-mail sa pri novej firme dohľadá zhruba pri každej desiatej, pri obchodných spoločnostiach asi pri každej piatej — zvyšok ešte žiadny web ani mapový záznam nemá.',
  en: 'Firms by founding date come from an index built on the Czech Statistical Office register — the whole region, not just its capital. ARES fills in the name and address. The index refreshes twice a month. A phone or e-mail turns up for roughly one new firm in ten, about one in five among companies — the rest have no website or map entry yet.',
};

/**
 * Jak daleko zpět má index z ČSÚ hledat, když je zapnutý některý z filtrů podle vzniku.
 * `null` = žádný takový filtr, hledá se po staru přes ARES. U víc filtrů naráz platí nejužší
 * (filtry se kombinují přes AND, takže užší okno stejně rozhodne).
 */
export const NEW_FIRM_WINDOW_DAYS: Record<string, number> = {
  new_firm_30d: 30,
  new_firm_90d: 90,
  new_firm_6m: 183,
  new_firm: 366,
  new_firm_5y: 1826,
};
export function registryWindowDays(filterIds: readonly string[]): number | null {
  const days = filterIds.map(id => NEW_FIRM_WINDOW_DAYS[id]).filter((d): d is number => d !== undefined);
  return days.length ? Math.min(...days) : null;
}

/**
 * Okno indexu i bez filtru podle vzniku, když chybí obor.
 *
 * Hledání bez oboru („jen živnostníci ve Zlínském kraji") umí jen index z ČSÚ — ARES potřebuje
 * NACE nebo slovo v názvu. Index sahá pět let zpět (`REGISTRY_INDEX_MONTHS`), takže se bez oboru
 * hledá v celém kraji mezi firmami vzniklými za posledních pět let; starší bez oboru najít nejdou
 * a UI to říká. S oborem a bez filtru podle vzniku se hledá po staru v ARESu.
 */
export function effectiveWindowDays(filterIds: readonly string[], industry: string): number | null {
  return registryWindowDays(filterIds) ?? (isAllIndustries(industry) ? NEW_FIRM_WINDOW_DAYS.new_firm_5y : null);
}

/** No founding date means no opinion about the firm's age — only ARES ever supplies one. */
const ageUnknown = (b: FilterableLead) => yearsSince(b.foundedAt) === null;

/** `vatPayer` is filled by the DPH enrichment; null means that lookup never returned. */
const vatUnknown = (b: FilterableLead) => b.vatPayer === null || b.vatPayer === undefined;

export const LEAD_FILTERS: LeadFilter[] = [
  {
    id: 'sole_trader',
    scope: 'index',
    group: 'who',
    kind: 'bool',
    source: 'ARES',
    label: { cs: 'Živnostník (OSVČ)', sk: 'Živnostník (SZČO)', en: 'Sole trader' },
    where: { legalForm: { in: SOLE_TRADER_FORMS } },
    test: b => Boolean(b.legalForm && SOLE_TRADER_FORMS.includes(b.legalForm)),
    unknown: b => !b.legalForm,
    evidence: (b, l) => b.legalForm ? localized({ cs: `právní forma ${b.legalForm} · ARES`, sk: `právna forma ${b.legalForm} · ARES`, en: `legal form ${b.legalForm} · ARES` }, l) : null,
  },
  {
    id: 'company_form',
    scope: 'index',
    group: 'who',
    kind: 'bool',
    source: 'ARES',
    label: { cs: 'Obchodní společnost (s.r.o., a.s.)', sk: 'Obchodná spoločnosť (s.r.o., a.s.)', en: 'Company (Ltd., plc)' },
    where: { legalForm: { not: null, notIn: SOLE_TRADER_FORMS } },
    test: b => Boolean(b.legalForm && !SOLE_TRADER_FORMS.includes(b.legalForm)),
    unknown: b => !b.legalForm,
    evidence: (b, l) => b.legalForm ? localized({ cs: `právní forma ${b.legalForm} · ARES`, sk: `právna forma ${b.legalForm} · ARES`, en: `legal form ${b.legalForm} · ARES` }, l) : null,
  },
  {
    /**
     * Tři stavy, ne dva. RES má kategorii počtu pracovníků vyplněnou u 49 % subjektů, u živnostníků
     * jen asi u 40 % (měřeno 13. 9. 2026). „Neuvedeno" (`000` nebo NULL) proto nikdy nespadne do
     * „bez zaměstnanců" — je to mezera, a ve výsledku se ukazuje jako „počet neuveden".
     */
    id: 'has_employees',
    scope: 'index',
    group: 'who',
    kind: 'bool',
    source: 'RES',
    label: { cs: 'Má zaměstnance', sk: 'Má zamestnancov', en: 'Has employees' },
    hint: { cs: 'Podle statistického registru (RES). U živnostníků je údaj vyplněný jen asi u 40 % — ostatní mají „počet neuveden" a filtr je nevybere ani nevyloučí.',
            sk: 'Podľa štatistického registra (RES). U živnostníkov je údaj vyplnený len asi u 40 % — ostatní majú „počet neuvedený" a filter ich nevyberie ani nevylúči.',
            en: 'From the statistical register (RES). For sole traders the value is filled in for only about 40 % — the rest show “count not stated” and are neither selected nor excluded.' },
    where: { employeeCategory: { notIn: ['000', '110'], not: null } },
    test: b => employeesKnown(b) && b.employeeCategory !== '110',
    unknown: b => !employeesKnown(b),
    evidence: (b, l) => employeesKnown(b) ? `${employeeLabel(b.employeeCategory, l)} · RES` : null,
  },
  {
    id: 'no_employees',
    scope: 'index',
    group: 'who',
    kind: 'bool',
    source: 'RES',
    label: { cs: 'Bez zaměstnanců', sk: 'Bez zamestnancov', en: 'No employees' },
    hint: { cs: '„Bez zaměstnanců" je jen tam, kde to registr výslovně říká. Neuvedený počet sem nepatří.',
            sk: '„Bez zamestnancov" je len tam, kde to register výslovne hovorí. Neuvedený počet sem nepatrí.',
            en: '“No employees” only where the register says so explicitly. An unstated count does not belong here.' },
    where: { employeeCategory: '110' },
    test: b => b.employeeCategory === '110',
    unknown: b => !employeesKnown(b),
    evidence: (b, l) => b.employeeCategory === '110' ? `${employeeLabel('110', l)} · RES` : null,
  },
  {
    /**
     * Negativní filtr: koho vyřadit. Jen příznak z ARESu (`stavZdrojeIr`). Podrobnosti by dal ISIR,
     * a ten se smí použít výhradně nad IČO, která už máme — nikdy jako zdroj seznamu a nikdy pro
     * fyzické osoby v oddlužení.
     */
    id: 'no_insolvency',
    group: 'standing',
    kind: 'bool',
    source: 'ARES',
    label: { cs: 'Bez insolvence', sk: 'Bez insolvencie', en: 'No insolvency' },
    hint: { cs: 'Podle příznaku v ARESu. Firmy, u kterých jsme se neptali (starší hledání), filtr nevybere ani nevyloučí.',
            sk: 'Podľa príznaku v ARESe. Firmy, pri ktorých sme sa nepýtali (staršie hľadania), filter nevyberie ani nevylúči.',
            en: 'From the ARES flag. Firms we never asked about (older searches) are neither selected nor excluded.' },
    where: { inInsolvency: false },
    test: b => b.inInsolvency === false,
    unknown: b => b.inInsolvency == null,
    evidence: (b, l) => b.inInsolvency === false ? localized({ cs: 'v insolvenčním rejstříku není · ARES', sk: 'v insolvenčnom registri nie je · ARES', en: 'not in the insolvency register · ARES' }, l) : null,
  },
  {
    id: 'in_insolvency',
    group: 'standing',
    kind: 'bool',
    source: 'ARES',
    label: { cs: 'V insolvenci', sk: 'V insolvencii', en: 'In insolvency' },
    where: { inInsolvency: true },
    test: b => b.inInsolvency === true,
    unknown: b => b.inInsolvency == null,
    evidence: (b, l) => b.inInsolvency === true ? localized({ cs: 'v insolvenčním rejstříku · ARES', sk: 'v insolvenčnom registri · ARES', en: 'in the insolvency register · ARES' }, l) : null,
  },
  {
    /**
     * Firmy, které dávají znát, že opravdu fungují.
     *
     * Proč zrovna tyhle tři podmínky a proč OR: ARES do výsledků nedává nikoho se zrušenou
     * živností, takže „má živnost, ale nepodniká" nejde poznat ze stavu živnosti. Nejblíž tomu
     * je počet aktivních provozoven — kdo je měl a všechny zrušil, skoro jistě skončil.
     * Změřeno na 100 kadeřnictvích ve Zlíně: 39 z nich nemá aktivní ani jednu.
     *
     * Plátcovství DPH a právní forma jsou tam jako druhá a třetí šance, ne jako přitvrzení.
     * Samotné by filtr posunuly ke korporacím, jenže ideální klient na web je často malá
     * aktivní živnostnice bez DPH — a ta má obvykle registrovanou provozovnu.
     *
     * Čím to lže: kadeřnice v pronajatém křesle nebo řemeslník jezdící ke klientům provozovnu
     * registrovanou mít nemusí. Proto jde filtr vypnout.
     */
    id: 'working',
    group: 'standing',
    label: { cs: 'Jen fungující podniky', sk: 'Len fungujúce podniky', en: 'Operating businesses only' },
    source: 'RŽP',
    evidence: (b, l) => b.activePremises != null && b.activePremises > 0
      ? localized({ cs: `${b.activePremises} aktivní provozovna/y · RŽP`, sk: `${b.activePremises} aktívna prevádzka/y · RŽP`, en: `${b.activePremises} active premises · RŽP` }, l)
      : b.vatPayer === true ? localized({ cs: 'plátce DPH · ARES', sk: 'platiteľ DPH · ARES', en: 'VAT registered · ARES' }, l)
      : b.legalForm && !SOLE_TRADER_FORMS.includes(b.legalForm) ? localized({ cs: `právní forma ${b.legalForm} · ARES`, sk: `právna forma ${b.legalForm} · ARES`, en: `legal form ${b.legalForm} · ARES` }, l)
      : (b.source ?? '').includes('osm') ? localized({ cs: 'zakreslena v OpenStreetMap', sk: 'zakreslená v OpenStreetMap', en: 'mapped in OpenStreetMap' }, l) : null,
    where: {
      OR: [
        { activePremises: { gt: 0 } },
        { vatPayer: true },
        { legalForm: { not: null, notIn: SOLE_TRADER_FORMS } },
        { source: { contains: 'osm' } },
      ],
    },
    test: b => hasActivePremises(b) || b.vatPayer === true || isCompany(b) || isMapped(b),
    /**
     * Nezeptali jsme se ani na jedno ze tří. Pro skórování je to mezera, ne odpověď — jinak by
     * firma bez IČO (tedy z OpenStreetMap, kde nemáme co dotazovat) vyšla jako potvrzeně mrtvá.
     */
    unknown: b => b.activePremises == null && b.vatPayer == null && !b.legalForm && !isMapped(b),
  },
  {
    /**
     * Přísnější stupeň: k provozovně navíc chce ekonomickou stopu. Krátký seznam na obvolání,
     * ne výchozí pohled — vyhodí i spoustu živých malých firem.
     */
    id: 'verified',
    group: 'standing',
    label: { cs: 'Jen prověřené', sk: 'Len preverené', en: 'Verified only' },
    where: {
      OR: [
        {
          AND: [
            { activePremises: { gt: 0 } },
            { OR: [{ vatPayer: true }, { legalForm: { not: null, notIn: SOLE_TRADER_FORMS } }] },
          ],
        },
        // Firma na mapě s dohledaným kontaktem: někdo u ní stál a je na koho zavolat.
        { AND: [{ source: { contains: 'osm' } }, { OR: [{ phone: { not: null } }, { email: { not: null } }] }] },
      ],
    },
    test: b =>
      (hasActivePremises(b) && (b.vatPayer === true || isCompany(b)))
      || (isMapped(b) && Boolean(b.phone || b.email)),
    unknown: b => b.activePremises == null && b.vatPayer == null && !b.legalForm && !isMapped(b),
  },
  {
    /**
     * Obě odpovědi, ve kterých web neznáme, v jednom chipu.
     *
     * Scénáře kombinují filtry přes AND (`matchesAll`), takže „web_unknown + no_website" by
     * nevrátilo nic — řádek nemůže být obojí. A samotné `no_website` je bez vyhledávače prázdné.
     * Tenhle filtr je to, co uživatel obvolává: firmy, u kterých web není vidět. Přesnější
     * rozdělení na „nemá" a „nešlo ověřit" zůstává vedle jako dva samostatné chipy.
     */
    id: 'no_web_found',
    group: 'reach',
    label: { cs: 'Web jsme nenašli', sk: 'Web sme nenašli', en: 'We found no website' },
    hint: {
      cs: 'Firmy s ověřeným „web nemá" i ty, u kterých web nešlo ověřit. Že web nemají, tím netvrdíme.',
      sk: 'Firmy s overeným „web nemá" aj tie, pri ktorých sa web nedal overiť. Že web nemajú, tým netvrdíme.',
      en: 'Firms with a verified “no website”, plus those we could not verify. Not a claim that they have none.',
    },
    where: STATUS_NOT_HAS,
    test: b => webStatusOf(b) !== 'HAS',
  },
  {
    id: 'no_website',
    group: 'reach',
    /**
     * „Web nemá" znamená doložené tvrzení: prošly se domény z názvu firmy, e-mailová doména, to,
     * co uvedly zdroje, **a zeptal se i vyhledávač** — a nic z toho web firmy nebyl (viz
     * `verifyWebsite`). Samotné neúspěšné hádání domén z názvu sem nepatří: na vzorku 100 firem
     * (11.–12. 9. 2026) bylo takové „nemá" špatně zhruba v každém třetím případě, protože firmy
     * mají web pod značkou, která z obchodního jména nevyplývá. To je teď `web_unknown`.
     */
    label: { cs: 'Web nemá', sk: 'Web nemá', en: 'Has no website' },
    hint: {
      cs: 'Prověřili jsme domény z názvu, doménu z e-mailu i vyhledávač a web firmy nikde není. Dokud vyhledávač neběží, zůstává tenhle filtr prázdný.',
      sk: 'Preverili sme domény z názvu, doménu z e-mailu aj vyhľadávač a web firmy nikde nie je. Kým vyhľadávač nebeží, zostáva tento filter prázdny.',
      en: 'We checked the domains from the name, the e-mail domain and the search engine, and there is no site. While the search engine is off, this filter stays empty.',
    },
    where: { websiteStatus: 'NONE' },
    test: b => webStatusOf(b) === 'NONE',
    // Neověřená firma není firma bez webu — do skóre se počítá jako „nevíme", ne jako shoda.
    unknown: b => webStatusOf(b) === 'UNKNOWN',
  },
  {
    id: 'web_unknown',
    group: 'reach',
    /**
     * Zbytek, u kterého odpověď neznáme: hledání došlo čas, zdroj web uváděl a ten neodpověděl,
     * nebo se z názvu firmy nedá odvodit doména („G A Dent s.r.o."). Je to malá skupina a patří
     * na světlo — tichým smícháním s „web nemá" vznikla přesně ta nedůvěra, kvůli které se to
     * celé předělávalo.
     */
    label: { cs: 'Web se nepodařilo ověřit', sk: 'Web sa nepodarilo overiť', en: 'Could not verify' },
    hint: {
      cs: 'Web jsme nenašli, ale netvrdíme, že ho firma nemá. Tady je většina firem — ověřit web nejde vždycky.',
      sk: 'Web sme nenašli, ale netvrdíme, že ho firma nemá. Tu je väčšina firiem — overiť web sa nedá vždy.',
      en: 'We found no site, but we are not claiming there is none. Most firms end up here — a website cannot always be verified.',
    },
    where: { websiteStatus: 'UNKNOWN' },
    test: b => webStatusOf(b) === 'UNKNOWN',
  },
  {
    id: 'has_website',
    group: 'reach',
    label: { cs: 'Má web', sk: 'Má web', en: 'Has website' },
    hint: {
      cs: 'Stránka se načetla a doložila, že patří té firmě — má na sobě IČO, nebo celý název i obor.',
      sk: 'Stránka sa načítala a doložila, že patrí tej firme — má na sebe IČO, alebo celý názov aj odbor.',
      en: 'The page loaded and proved it belongs to that firm — its company number, or its full name with the trade.',
    },
    where: STATUS_HAS,
    test: b => webStatusOf(b) === 'HAS',
    // Symmetrically: a row we never resolved is not a firm that demonstrably lacks a website.
    unknown: b => webStatusOf(b) === 'UNKNOWN',
  },
  {
    id: 'old_website',
    group: 'reach',
    label: { cs: 'Zastaralý web', sk: 'Zastaraný web', en: 'Outdated website' },
    where: { websiteIsOld: true },
    test: b => Boolean(b.websiteIsOld),
    // You cannot call a site outdated if you never found the site.
    unknown: b => !b.websiteIsOld && webStatusOf(b) !== 'HAS',
  },
  {
    id: 'insecure_website',
    group: 'reach',
    /**
     * Web bez HTTPS. Protokol čteme z uložené adresy, takže to nestojí ani jeden další request —
     * `website` je ta adresa, na které stránka při ověřování skutečně odpověděla.
     *
     * Proč je to signál a ne jen technický detail: prohlížeče u takové stránky píšou „Nezabezpečeno",
     * a firma, která to nechala být, s webem pravděpodobně roky nikdo nehnul.
     */
    label: { cs: 'Web bez HTTPS', sk: 'Web bez HTTPS', en: 'No HTTPS' },
    where: { AND: [STATUS_HAS, { website: { startsWith: 'http://' } }] },
    test: b => webStatusOf(b) === 'HAS' && Boolean(b.website?.startsWith('http://')),
    // U firmy, které jsme web nenašli, se nedá říct nic — ani že HTTPS má, ani že nemá.
    unknown: b => webStatusOf(b) !== 'HAS',
  },
  {
    id: 'has_contact_page',
    group: 'reach',
    /**
     * Firma má na webu stránku „Kontakt". Čteme ji z odkazu na její vlastní homepage, takže
     * i tohle je zadarmo. Pro oslovení je to nejkratší cesta: bývá tam adresa, otvírací doba
     * a často jméno člověka, se kterým budete mluvit.
     */
    label: { cs: 'Má kontaktní stránku', sk: 'Má kontaktnú stránku', en: 'Has a contact page' },
    where: { NOT: [{ contactUrl: null }, { contactUrl: '' }] },
    test: b => Boolean(b.contactUrl),
    // Odkaz na kontakty čteme jen z homepage. Bez webu jsme neměli kde hledat.
    unknown: b => !b.contactUrl && webStatusOf(b) !== 'HAS',
  },
  {
    id: 'can_reach',
    group: 'reach',
    /**
     * „Mám ji jak oslovit."
     *
     * Nejširší z kontaktních filtrů schválně: telefon, e-mail, profil na síti i web s kontakty
     * jsou různě dobré cesty, ale všechny končí u člověka. Odfiltruje se přesně to, co skončí
     * ve slepé uličce — firma, o které víme jen jméno a adresu sídla. Ve výsledcích hledání
     * kadeřnictví ve Zlíně je to většina řádků, takže ten filtr má co dělat.
     */
    label: { cs: 'Mám jak oslovit', sk: 'Mám ako osloviť', en: 'I can reach them' },
    where: {
      OR: [
        { NOT: [{ phone: null }, { phone: '' }] },
        { NOT: [{ email: null }, { email: '' }] },
        { NOT: [{ contactUrl: null }, { contactUrl: '' }] },
        { hasFacebook: true },
        { hasInstagram: true },
        STATUS_HAS,
      ],
    },
    test: b => hasReachChannel(b),
  },
  {
    id: 'has_contact',
    group: 'reach',
    // Part of the neutral default scoring in lead-score.ts: whatever you sell, a firm you
    // cannot reach is not a lead.
    label: { cs: 'Má telefon nebo e-mail', sk: 'Má telefón alebo e-mail', en: 'Has phone or e-mail' },
    where: {
      OR: [
        { NOT: [{ phone: null }, { phone: '' }] },
        { NOT: [{ email: null }, { email: '' }] },
      ],
    },
    test: b => Boolean(b.phone || b.email),
  },
  {
    id: 'no_contact',
    group: 'reach',
    label: { cs: 'Bez telefonu i e-mailu', sk: 'Bez telefónu aj e-mailu', en: 'No phone or e-mail' },
    where: {
      AND: [
        { OR: [{ phone: null }, { phone: '' }] },
        { OR: [{ email: null }, { email: '' }] },
      ],
    },
    test: b => !b.phone && !b.email,
  },
  /**
   * Meta Knihovna reklam (sources/meta-ads.ts). Trojice stojí na spárování firmy s inzerentem,
   * které se povede jen u části firem — proto `unknown` u všech nespárovaných: skóre je
   * nepenalizuje a UI o nich netvrdí, že neinzerují.
   */
  {
    id: 'ads_meta',
    group: 'event',
    label: { cs: 'Inzeruje na Meta', sk: 'Inzeruje na Meta', en: 'Advertises on Meta' },
    source: 'Meta',
    hint: META_HINT,
    where: { adsPageId: { not: null } },
    test: b => Boolean(b.adsPageId),
    unknown: b => !b.adsPageId,
    evidence: adsEvidence,
  },
  {
    id: 'ads_no_web',
    group: 'reach',
    label: { cs: 'Inzeruje, ale reklama nevede na web', sk: 'Inzeruje, ale reklama nevedie na web', en: 'Advertises, but the ad leads nowhere on the web' },
    source: 'Meta',
    hint: {
      cs: 'Platí za reklamu na Facebooku či Instagramu, žádná z jejích reklam nevede na web a my jsme web nenašli. Nejlepší lead pro tvůrce webů: marketing už si platí.',
      sk: 'Platí za reklamu na Facebooku či Instagrame, žiadna z jej reklám nevedie na web a my sme web nenašli. Najlepší lead pre tvorcu webov: marketing si už platí.',
      en: 'Pays for Facebook or Instagram ads, none of them links to a website and we found none. The best lead for a web developer: they already pay for marketing.',
    },
    where: { AND: [{ adsPageId: { not: null } }, { adsLinkDomain: null }, { NOT: STATUS_HAS }] },
    test: b => Boolean(b.adsPageId) && !b.adsLinkDomain && webStatusOf(b) !== 'HAS',
    unknown: b => !b.adsPageId,
    evidence: (b, l) => b.adsPageId && !b.adsLinkDomain ? localized({ cs: 'reklamy nevedou na web · Knihovna reklam Meta', sk: 'reklamy nevedú na web · Knižnica reklám Meta', en: 'ads do not link to a website · Meta Ad Library' }, l) : null,
  },
  {
    id: 'ads_dated_web',
    group: 'reach',
    label: { cs: 'Inzeruje a web působí zastarale', sk: 'Inzeruje a web pôsobí zastaralo', en: 'Advertises and the website looks dated' },
    source: 'Meta',
    hint: {
      cs: 'Platí za reklamu a její ověřený web propadl v auditu (bez HTTPS, bez mobilní verze, starý kód). Peníze na marketing má, web je brzdí.',
      sk: 'Platí za reklamu a jej overený web prepadol v audite (bez HTTPS, bez mobilnej verzie, starý kód). Peniaze na marketing má, web ju brzdí.',
      en: 'Pays for ads and its verified website failed the audit (no HTTPS, no mobile version, old code). Has a marketing budget, the site holds it back.',
    },
    where: { adsPageId: { not: null }, websiteIsOld: true },
    test: b => Boolean(b.adsPageId) && Boolean(b.websiteIsOld),
    unknown: b => !b.adsPageId || webStatusOf(b) !== 'HAS',
    evidence: adsEvidence,
  },
  {
    id: 'has_phone',
    group: 'reach',
    label: { cs: 'Má telefon', sk: 'Má telefón', en: 'Has phone' },
    where: { NOT: [{ phone: null }, { phone: '' }] },
    test: b => Boolean(b.phone),
  },
  {
    id: 'has_email',
    group: 'reach',
    label: { cs: 'Má e-mail', sk: 'Má e-mail', en: 'Has e-mail' },
    where: { NOT: [{ email: null }, { email: '' }] },
    test: b => Boolean(b.email),
  },
  {
    id: 'has_social',
    group: 'reach',
    label: { cs: 'Má sociální sítě', sk: 'Má sociálne siete', en: 'Has social profiles' },
    source: 'web',
    hint: { cs: 'Odkaz na Facebook, Instagram nebo LinkedIn našel náš robot na webu firmy, nebo ho uvedl mapér v OpenStreetMap. Firma, která sítě spravuje, obvykle odpoví i na zprávu.',
            sk: 'Odkaz na Facebook, Instagram alebo LinkedIn našiel náš robot na webe firmy, alebo ho uviedol mapér v OpenStreetMap. Firma, ktorá siete spravuje, obvykle odpovie aj na správu.',
            en: 'A link to Facebook, Instagram or LinkedIn found on the firm’s own site, or tagged by a mapper in OpenStreetMap. A firm that keeps its profiles usually answers a message too.' },
    where: { OR: [{ hasFacebook: true }, { hasInstagram: true }, { hasLinkedIn: true }] },
    test: b => hasSocial(b),
    unknown: b => !hasSocial(b) && !b.socialsChecked,
    evidence: (b, l) => hasSocial(b)
      ? localized({ cs: 'profil na sociální síti · web firmy / OpenStreetMap', sk: 'profil na sociálnej sieti · web firmy / OpenStreetMap', en: 'social profile · firm’s website / OpenStreetMap' }, l)
      : null,
  },
  {
    id: 'no_social',
    group: 'reach',
    /**
     * Named after the not-finding, exactly like `no_website` above — and for the same reason.
     * The chip prints how many rows it would leave, so on a run where nobody's homepage was
     * fetched the old wording read „Bez sociálních sítí 500": a claim about 500 firms, made
     * without opening a single page. „Sítě jsme nenašli" is the same number and true.
     */
    label: { cs: 'Sítě jsme nenašli', sk: 'Siete sme nenašli', en: 'We found no profiles' },
    where: { hasFacebook: false, hasInstagram: false, hasLinkedIn: false },
    test: b => !hasSocial(b),
    /**
     * Social profiles are only ever read off the firm's own homepage. With no page there was
     * nothing to read, and three untouched `false`s are not a finding — scoring them as one
     * handed a free point to every row we knew least about.
     */
    unknown: b => !hasSocial(b) && !b.socialsChecked,
  },
  {
    id: 'no_web_has_fb',
    group: 'reach',
    /**
     * Firmy, které se dají oslovit přes Facebook, protože jinudy to nejde.
     *
     * Nálepka nezní „Nemá web, ale má Facebook", i když přesně tak se ta skupina používá:
     * že firma web nemá, netvrdíme nikde — ARES weby needviduje a my jsme ho jen nenašli.
     * Druhá polovina je naopak tvrzení doložené, protože odkaz na profil buď stál na vlastním
     * webu firmy, nebo ho k jejímu záznamu připojil mapér v OpenStreetMap.
     */
    label: { cs: 'Web jsme nenašli, Facebook ano', sk: 'Web sme nenašli, Facebook áno', en: 'No website found, but has Facebook' },
    where: { AND: [STATUS_NOT_HAS, { hasFacebook: true }] },
    test: b => webStatusOf(b) !== 'HAS' && Boolean(b.hasFacebook),
    /**
     * Jako kritérium to znamená „na tuhle firmu se dá dostat, i když web nemá". Když jsme se
     * po profilech nikdy nedívali, není to ani splněné, ani nesplněné — polovina kreditu,
     * stejně jako u ostatních otázek, na které nemáme odpověď.
     */
    unknown: b => !b.hasFacebook && !b.socialsChecked,
  },
  {
    id: 'no_category',
    scope: 'index',
    group: 'who',
    label: { cs: 'Bez uvedeného oboru', sk: 'Bez uvedeného odboru', en: 'No trade listed' },
    where: { OR: [{ category: null }, { category: '' }] },
    test: b => !b.category,
  },
  {
    id: 'new_firm',
    scope: 'index',
    group: 'event',
    // The entry date in ARES is exact, so "founded in the last year" is one of the few things
    // we can state without hedging. It is the whole lead list for an accountant or a bookkeeper.
    label: { cs: 'Nová firma (do 1 roku)', sk: 'Nová firma (do 1 roka)', en: 'New firm (under 1 year)' },
    hint: REGISTRY_HINT,
    source: 'ARES',
    evidence: (b, l) => { const d = fmtDate(b.foundedAt, l); return d ? localized({ cs: `vznik ${d} · ARES`, sk: `vznik ${d} · ARES`, en: `founded ${d} · ARES` }, l) : null; },
    where: { foundedAt: { gt: foundedBefore(1) } },
    test: youngerThan(1),
    unknown: ageUnknown,
  },
  {
    id: 'new_firm_6m',
    scope: 'index',
    group: 'event',
    // Užší varianta `new_firm`. Datum vzniku v ARESu je přesné, takže i tenhle půlrok je fakt,
    // ne odhad — a je to celý seznam pro účetní nebo pojišťováka, který chce být první.
    label: { cs: 'Nová firma (do 6 měsíců)', sk: 'Nová firma (do 6 mesiacov)', en: 'New firm (under 6 months)' },
    hint: REGISTRY_HINT,
    source: 'ARES',
    evidence: (b, l) => { const d = fmtDate(b.foundedAt, l); return d ? localized({ cs: `vznik ${d} · ARES`, sk: `vznik ${d} · ARES`, en: `founded ${d} · ARES` }, l) : null; },
    where: { foundedAt: { gt: foundedBefore(0.5) } },
    test: youngerThan(0.5),
    unknown: ageUnknown,
  },
  {
    id: 'new_firm_90d',
    scope: 'index',
    group: 'event',
    label: { cs: 'Nová firma (do 90 dnů)', sk: 'Nová firma (do 90 dní)', en: 'New firm (under 90 days)' },
    hint: REGISTRY_HINT,
    source: 'ARES',
    evidence: (b, l) => { const d = fmtDate(b.foundedAt, l); return d ? localized({ cs: `vznik ${d} · ARES`, sk: `vznik ${d} · ARES`, en: `founded ${d} · ARES` }, l) : null; },
    where: { foundedAt: { gt: foundedDaysAgo(90) } },
    test: youngerThanDays(90),
    unknown: ageUnknown,
  },
  {
    id: 'new_firm_30d',
    scope: 'index',
    group: 'event',
    label: { cs: 'Nová firma (do 30 dnů)', sk: 'Nová firma (do 30 dní)', en: 'New firm (under 30 days)' },
    hint: REGISTRY_HINT,
    source: 'ARES',
    evidence: (b, l) => { const d = fmtDate(b.foundedAt, l); return d ? localized({ cs: `vznik ${d} · ARES`, sk: `vznik ${d} · ARES`, en: `founded ${d} · ARES` }, l) : null; },
    where: { foundedAt: { gt: foundedDaysAgo(30) } },
    test: youngerThanDays(30),
    unknown: ageUnknown,
  },
  {
    id: 'new_firm_5y',
    group: 'event',
    scope: 'index',
    // Celé okno indexu. Není to „událost" v pravém smyslu — je to přepínač: s ním se hledá
    // v celém kraji z indexu (úplně, s počty), bez něj v ARESu po krajském městě.
    label: { cs: 'Vznik do 5 let', sk: 'Vznik do 5 rokov', en: 'Founded within 5 years' },
    hint: { cs: 'Zapne hledání v celém kraji z indexu ČSÚ. Bez okna podle vzniku se hledá v ARESu jen po krajském městě a bez počtů dopředu.',
            sk: 'Zapne hľadanie v celom kraji z indexu ČSÚ. Bez okna podľa vzniku sa hľadá v ARESe len po krajskom meste a bez počtov vopred.',
            en: 'Turns on whole-region search from the CZSO index. Without a founding window the search runs in ARES by regional capital only, with no counts up front.' },
    source: 'ARES',
    evidence: (b, l) => { const d = fmtDate(b.foundedAt, l); return d ? localized({ cs: `vznik ${d} · ARES`, sk: `vznik ${d} · ARES`, en: `founded ${d} · ARES` }, l) : null; },
    where: { foundedAt: { gt: foundedDaysAgo(1826) } },
    test: youngerThanDays(1826),
    unknown: ageUnknown,
  },
  {
    id: 'established_3y',
    group: 'standing',
    label: { cs: 'Firma 3+ roky', sk: 'Firma 3+ roky', en: '3+ years old' },
    source: 'ARES',
    evidence: (b, l) => { const d = fmtDate(b.foundedAt, l); return d ? localized({ cs: `vznik ${d} · ARES`, sk: `vznik ${d} · ARES`, en: `founded ${d} · ARES` }, l) : null; },
    where: { foundedAt: { lte: foundedBefore(3) } },
    test: olderThan(3),
    unknown: ageUnknown,
  },
  {
    id: 'established_10y',
    group: 'standing',
    label: { cs: 'Firma 10+ let', sk: 'Firma 10+ rokov', en: '10+ years old' },
    source: 'ARES',
    evidence: (b, l) => { const d = fmtDate(b.foundedAt, l); return d ? localized({ cs: `vznik ${d} · ARES`, sk: `vznik ${d} · ARES`, en: `founded ${d} · ARES` }, l) : null; },
    where: { foundedAt: { lte: foundedBefore(10) } },
    test: olderThan(10),
    unknown: ageUnknown,
  },
  {
    id: 'vat_payer',
    group: 'standing',
    label: { cs: 'Plátce DPH', sk: 'Platiteľ DPH', en: 'VAT registered' },
    source: 'ARES',
    evidence: (b, l) => b.vatPayer === true ? localized({ cs: 'plátce DPH · ARES/MFČR', sk: 'platiteľ DPH · ARES/MFČR', en: 'VAT registered · ARES/MFČR' }, l) : null,
    where: { vatPayer: true },
    test: b => b.vatPayer === true,
    unknown: vatUnknown,
  },
  {
    id: 'vat_none',
    group: 'standing',
    label: { cs: 'Neplátce DPH', sk: 'Neplatiteľ DPH', en: 'Not VAT registered' },
    source: 'ARES',
    evidence: (b, l) => b.vatPayer === false ? localized({ cs: 'v registru plátců DPH není · ARES', sk: 'v registri platiteľov DPH nie je · ARES', en: 'not in the VAT register · ARES' }, l) : null,
    where: { vatPayer: false },
    test: b => b.vatPayer === false,
    unknown: vatUnknown,
  },
  {
    id: 'vat_reliable_only',
    group: 'standing',
    label: { cs: 'Vyřadit nespolehlivé plátce', sk: 'Vyradiť nespoľahlivých platiteľov', en: 'Exclude unreliable VAT payers' },
    source: 'MFČR',
    hint: { cs: 'Nespolehlivý plátce je veřejný příznak finanční správy. Firmy bez příznaku i neplátci projdou.',
            sk: 'Nespoľahlivý platiteľ je verejný príznak finančnej správy. Firmy bez príznaku aj neplatitelia prejdú.',
            en: 'An unreliable VAT payer is a public tax-office flag. Firms without the flag and non-payers pass.' },
    evidence: (b, l) => b.vatUnreliable === false ? localized({ cs: 'bez příznaku nespolehlivosti · MFČR', sk: 'bez príznaku nespoľahlivosti · MFČR', en: 'no unreliability flag · MFČR' }, l) : null,
    where: { NOT: { vatUnreliable: true } },
    test: b => b.vatUnreliable !== true,
  },
  {
    id: 'vat_unreliable',
    group: 'standing',
    label: { cs: 'Nespolehlivý plátce', sk: 'Nespoľahlivý platiteľ', en: 'Unreliable VAT payer' },
    source: 'MFČR',
    evidence: (b, l) => b.vatUnreliable === true ? localized({ cs: 'nespolehlivý plátce · MFČR', sk: 'nespoľahlivý platiteľ · MFČR', en: 'unreliable VAT payer · MFČR' }, l) : null,
    where: { vatUnreliable: true },
    test: b => b.vatUnreliable === true,
  },
];

const BY_ID = new Map(LEAD_FILTERS.map(f => [f.id, f]));

/** Unknown ids are dropped, not rejected — a stale bookmark should still return results. */
export function resolveFilters(ids: string[]): LeadFilter[] {
  return ids.map(id => BY_ID.get(id)).filter((f): f is LeadFilter => f !== undefined);
}

/** All active filters must hold. Combining is always AND, never OR. */
export function matchesAll(b: FilterableLead, active: Iterable<string>): boolean {
  return resolveFilters(Array.from(active)).every(f => f.test(b));
}

/**
 * The trade and the town are not fixed lists: they are whatever the current result set
 * happens to contain, so a new source bringing new trades needs no code change here.
 */
export function facetValues(rows: FilterableLead[], key: 'category' | 'city'): string[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = key === 'category' ? row.category : cityOf(row.address);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'cs'))
    .map(([value]) => value);
}

/**
 * Czech addresses end in "..., 60200 Brno" or "..., Brno". Take the last comma-separated part
 * and drop a leading postcode. Wrong for a handful of odd addresses, and that is acceptable —
 * this only ever narrows a list the user is already looking at.
 */
export function cityOf(address?: string | null): string | undefined {
  if (!address) return undefined;
  const last = address.split(',').pop()?.trim();
  if (!last) return undefined;
  const city = last.replace(/^\d{3}\s?\d{2}\s+/, '').trim();
  return city || undefined;
}

/**
 * Co z aktivních filtrů umí index zúžit ještě před stahováním. Čte to registrový zdroj
 * (lib/sources/registry.ts) i počty pro skládačku (/api/index/counts). Protichůdné volby
 * (živnostník i společnost naráz) dají prázdný průnik — stejně jako by dal AND u řádků.
 */
export function indexConstraints(filterIds: readonly string[]) {
  const ids = new Set(filterIds);
  return {
    soleTrader: ids.has('sole_trader'),
    company: ids.has('company_form'),
    hasEmployees: ids.has('has_employees'),
    noEmployees: ids.has('no_employees'),
    noCategory: ids.has('no_category'),
    /**
     * „Firma 3+ / 10+ let" jde v režimu indexu rovnou do dotazu (index zná datum vzniku). Dřív se
     * uplatnila až nad staženými firmami — a protože index vrací nejnovější, z dvaceti stažených
     * neprošla žádná a uživatel viděl „0 z 20".
     */
    olderThanYears: ids.has('established_10y') ? 10 : ids.has('established_3y') ? 3 : null,
    windowDays: registryWindowDays(filterIds),
  };
}

/**
 * Podmínky, které nemůžou platit současně.
 *
 * Filtry se kombinují přes AND, takže „živnostník" a „obchodní společnost" naráz vrátí vždy
 * nulu. 15. 9. 2026 majitel zapnul všech 34 chipů, hledání doběhlo s 0 firmami a vypadalo to
 * jako pád. Teď zapnutí jedné podmínky vypne ty, se kterými se vylučuje (`addFilter`), a server
 * totéž udělá s tím, co přijde (`normalizeFilters`, pozdější vyhrává).
 */
const NEW_WINDOWS = ['new_firm_30d', 'new_firm_90d', 'new_firm_6m', 'new_firm', 'new_firm_5y'];
const WEB_REQUIRED = ['has_website', 'old_website', 'insecure_website', 'has_contact_page', 'ads_dated_web'];
const WEB_ABSENT = ['no_web_found', 'no_website', 'web_unknown', 'no_web_has_fb', 'ads_no_web'];
const EXCLUSIVE_SETS: string[][] = [
  ['sole_trader', 'company_form'],
  ['has_employees', 'no_employees'],
  ['no_insolvency', 'in_insolvency'],
  ['vat_payer', 'vat_none'],
  ['vat_reliable_only', 'vat_unreliable'],
  // Okna podle vzniku jsou do sebe vnořená; dvě naráz by platilo jen to užší a chip by lhal.
  NEW_WINDOWS,
  ['established_3y', 'established_10y'],
  ['has_website', 'no_web_found', 'no_website', 'web_unknown'],
  ['has_contact', 'no_contact'],
];
const EXTRA_CONFLICTS: Array<[string, string]> = [
  ['vat_none', 'vat_unreliable'],
  ['no_contact', 'has_phone'],
  ['no_contact', 'has_email'],
  ['no_contact', 'can_reach'],
  ['no_social', 'no_web_has_fb'],
  ...WEB_REQUIRED.flatMap(a => WEB_ABSENT.map(b => [a, b] as [string, string])),
  ...['new_firm_30d', 'new_firm_90d', 'new_firm_6m', 'new_firm'].map(w => ['established_3y', w] as [string, string]),
  ...NEW_WINDOWS.map(w => ['established_10y', w] as [string, string]),
];
const CONFLICTS = new Map<string, Set<string>>();
function linkConflict(a: string, b: string) {
  if (a === b) return;
  if (!CONFLICTS.has(a)) CONFLICTS.set(a, new Set());
  if (!CONFLICTS.has(b)) CONFLICTS.set(b, new Set());
  CONFLICTS.get(a)!.add(b);
  CONFLICTS.get(b)!.add(a);
}
for (const set of EXCLUSIVE_SETS) for (const a of set) for (const b of set) linkConflict(a, b);
for (const [a, b] of EXTRA_CONFLICTS) linkConflict(a, b);

/** Id podmínek, které s `id` nemůžou platit současně. */
export function conflictsWith(id: string): string[] {
  return Array.from(CONFLICTS.get(id) ?? []);
}

/** Zapne `id` a vypne všechno, s čím se vylučuje. Vrací novou množinu. */
export function addFilter(active: Iterable<string>, id: string): Set<string> {
  const next = new Set(active);
  for (const c of conflictsWith(id)) next.delete(c);
  next.add(id);
  return next;
}

/** Odstraní protiklady z uloženého nebo poslaného seznamu; pozdější podmínka vyhrává. */
export function normalizeFilters(ids: readonly string[]): string[] {
  let set = new Set<string>();
  for (const id of ids) set = addFilter(set, id);
  return Array.from(set);
}
