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
    hint: {
      // Přesně to, co filtr dělá. „Firmy bez webu" je název scénáře, ne tvrzení o firmách:
      // že jsme web nenašli, neznamená, že žádný nemají — ARES weby needviduje.
      cs: 'Zůstanou firmy, u kterých jsme žádný web nedohledali. Že ho nemají, tím neříkáme — jen že jsme ho nenašli.',
      sk: 'Zostanú firmy, pri ktorých sme žiadny web nedohľadali. Že ho nemajú, tým nehovoríme — len že sme ho nenašli.',
      en: 'Keeps the firms we found no website for. That is not a claim they have none — only that we did not find one.',
    },
    filters: ['no_website'],
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
    id: 'new',
    label: { cs: 'Nové firmy', sk: 'Nové firmy', en: 'New firms' },
    hint: {
      cs: 'Firmy zapsané do rejstříku během posledního půlroku. Datum vzniku je z ARESu, takže je přesné.',
      sk: 'Firmy zapísané do registra počas posledného polroka. Dátum vzniku je z ARESu, takže je presný.',
      en: 'Firms entered in the register within the last six months. The date comes from ARES, so it is exact.',
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
  accounting: 'new',
  finance: 'new',
  legal: 'new',
  photo: 'all',
  realestate: 'all',
  cleaning: 'all',
  it: 'old_web',
  consulting: 'all',
  other: 'all',
};
