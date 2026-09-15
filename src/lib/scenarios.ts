import { localized } from './lead-filters';

/**
 * Předpřipravené scénáře hledání.
 *
 * Filtry a kritéria už v aplikaci jsou, jenže jich je devatenáct a rozdělené do tří skupin.
 * Člověk, který otevře aplikaci poprvé, neví, které z nich mají smysl dohromady — a přitom
 * skoro každý chce jednu ze čtyř věcí. Scénář je pojmenovaná dvojice „tyhle filtry zapni,
 * podle tohohle seřaď".
 *
 * Důležité, co scénář **není**: nesahá do vyhledávání. Stažení dat z ARESu a OpenStreetMap,
 * ověřování webů i skóre běží úplně stejně jako předtím; scénář jen vybere a seřadí to, co už
 * je v prohlížeči. Kdyby zasahoval do pipeline, znamenal by čtyři různé cesty kódem, které se
 * musí zvlášť testovat — a jednu z nich by nikdo nikdy nespustil.
 */

export interface Scenario {
  id: string;
  label: { cs: string; sk?: string; en: string };
  /** Co uživateli slíbí. Musí sedět s `filters` — jinak je to popisek, ne pravda. */
  hint: { cs: string; sk?: string; en: string };
  /** Id z LEAD_FILTERS, která se zapnou. Prázdné pole = neomezovat. */
  filters: string[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'all',
    label: { cs: 'Všechny firmy v oboru', sk: 'Všetky firmy v odbore', en: 'Every firm in the trade' },
    hint: {
      cs: 'Nic neodfiltruje. Pořadí určuje skóre podle kritérií z vašeho účtu.',
      sk: 'Nič neodfiltruje. Poradie určuje skóre podľa kritérií z vášho účtu.',
      en: 'Filters nothing out. The order comes from your account criteria.',
    },
    filters: [],
  },
  {
    id: 'no_web',
    /**
     * Jméno scénáře je schválně totožné s filtrem, který zapíná.
     *
     * Předtím se jmenoval „Firmy bez webu" — což je tvrzení o firmách, a to my doložit neumíme:
     * ARES weby needviduje. Filtr pod ním se přitom vždycky jmenoval „Web jsme nenašli", tedy
     * tvrzení o našem hledání. Uživatel klikl na jedno a dostal druhé, a rozdíl mezi tím vypadal
     * jako chyba filtru. Teď říkají obě nálepky totéž a v seznamu chipů se rozsvítí ta stejná.
     */
    label: { cs: 'Web jsme nenašli', sk: 'Web sme nenašli', en: 'We found no website' },
    /**
     * Scénář pouští oba stavy, ve kterých web neznáme.
     *
     * Do teď zapínal jen `no_website`, tedy doložené „web nemá" — a to aplikace bez vyhledávače
     * neřekne u nikoho, takže nejpoužívanější scénář vracel prázdno. Filtry se kombinují přes AND,
     * takže dvojice „nevíme + nemá" by taky nevrátila nic; obojí naráz umí filtr `no_web_found`.
     */
    hint: {
      cs: 'Zůstanou firmy, u kterých web neznáme — buď jsme ho nenašli, nebo ho nešlo ověřit. Že ho nemají, tím neříkáme.',
      sk: 'Zostanú firmy, pri ktorých web nepoznáme — buď sme ho nenašli, alebo sa nedal overiť. Že ho nemajú, tým nehovoríme.',
      en: 'Keeps the firms whose website we do not know — either we found none, or it could not be verified. That is not a claim they have none.',
    },
    filters: ['no_web_found'],
  },
  {
    id: 'old_web',
    label: { cs: 'Firmy se zastaralým webem', sk: 'Firmy so zastaraným webom', en: 'Firms with a dated website' },
    hint: {
      cs: 'Firmy s ověřeným webem, který běží bez HTTPS — prohlížeč u něj návštěvníkovi píše „Nezabezpečeno".',
      sk: 'Firmy s overeným webom, ktorý beží bez HTTPS — prehliadač pri ňom návštevníkovi píše „Nezabezpečené".',
      en: 'Firms with a verified website served without HTTPS — the browser tells their visitors it is “not secure”.',
    },
    filters: ['insecure_website'],
  },
  {
    id: 'ads_no_web',
    label: { cs: 'Platí za reklamu, web nemá', sk: 'Platí za reklamu, web nemá', en: 'Pays for ads, has no website' },
    hint: {
      cs: 'Firmy z Meta Knihovny reklam, jejichž reklamy nevedou na web a my jsme web nenašli. Vyžaduje přístup k Ad Library API; spárování s inzerentem se povede jen u části firem.',
      sk: 'Firmy z Meta Knižnice reklám, ktorých reklamy nevedú na web a my sme web nenašli. Vyžaduje prístup k Ad Library API; spárovanie s inzerentom sa podarí len pri časti firiem.',
      en: 'Firms from the Meta Ad Library whose ads do not link to a website and where we found none. Needs Ad Library API access; matching succeeds only for some firms.',
    },
    filters: ['ads_no_web'],
  },
  {
    id: 'new',
    label: { cs: 'Nové firmy', sk: 'Nové firmy', en: 'New firms' },
    hint: {
      cs: 'Firmy zapsané do rejstříku během posledního půlroku, v celém kraji. Vybírají se z indexu RES ČSÚ, jméno a sídlo doplní ARES — datum vzniku je přesné.',
      sk: 'Firmy zapísané do registra počas posledného polroka, v celom kraji. Vyberajú sa z indexu RES ČSÚ, meno a sídlo doplní ARES — dátum vzniku je presný.',
      en: 'Firms entered in the register within the last six months, across the whole region. They come from the Czech Statistical Office index; ARES fills in name and address — the date is exact.',
    },
    filters: ['new_firm_6m'],
  },
];

const BY_ID = new Map(SCENARIOS.map(s => [s.id, s]));

export function scenarioById(id: string | null | undefined): Scenario {
  return (id && BY_ID.get(id)) || SCENARIOS[0];
}

export function scenarioLabel(id: string | null | undefined, locale: string): string {
  return localized(scenarioById(id).label, locale);
}

/**
 * Výchozí scénář pro profesi z onboardingu. Jen výchozí hodnota — přepínač zůstane nad
 * formulářem a uživatel ho může kdykoli změnit.
 */
export const SCENARIO_BY_PROFESSION: Record<string, string> = {
  web: 'no_web',
  marketing: 'old_web',
  finance: 'new',
  legal: 'all',
  b2b: 'all',
  other: 'all',
};
