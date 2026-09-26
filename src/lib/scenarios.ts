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

export type ScenarioIcon = 'globe' | 'social' | 'shield' | 'megaphone' | 'sparkles' | 'phone' | 'search' | 'list' | 'bed';

export interface Scenario {
  id: string;
  label: { cs: string; sk?: string; en: string };
  /** Komu ten seznam pomůže — jedna profese nebo dvě, ať se v sekcích každý najde. */
  forWhom?: { cs: string; sk?: string; en: string };
  /** Ikona sekce ve výběru; kreslí ji stránka (lucide), tady je jen jméno. */
  icon?: ScenarioIcon;
  /** Co uživateli slíbí. Musí sedět s `filters` — jinak je to popisek, ne pravda. */
  hint: { cs: string; sk?: string; en: string };
  /** Nápis na tlačítku Vyhledat („Najít firmy bez webu") — záměr má být čitelný z jednoho tlačítka. */
  action: { cs: string; sk?: string; en: string };
  /** Id z LEAD_FILTERS, která se zapnou. Prázdné pole = neomezovat. */
  filters: string[];
  /**
   * Obory, které sekce nastaví (slugy z nace-map). Jen u režimů vázaných na obor — „Ubytování
   * a wellness"; ostatní sekce obor nechávají na uživateli.
   */
  industries?: string[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'all',
    icon: 'search',
    forWhom: { cs: 'kdokoli', sk: 'ktokoľvek', en: 'anyone' },
    label: { cs: 'Všechny firmy v oboru', sk: 'Všetky firmy v odbore', en: 'Every firm in the trade' },
    action: { cs: 'Najít firmy', sk: 'Nájsť firmy', en: 'Find firms' },
    hint: {
      cs: 'Nic neodfiltruje. Pořadí určuje skóre podle kritérií z vašeho účtu.',
      sk: 'Nič neodfiltruje. Poradie určuje skóre podľa kritérií z vášho účtu.',
      en: 'Filters nothing out. The order comes from your account criteria.',
    },
    filters: [],
  },
  {
    id: 'no_web',
    icon: 'globe',
    forWhom: { cs: 'tvůrci webů', sk: 'tvorcovia webov', en: 'web developers' },
    /**
     * Jméno scénáře je schválně totožné s filtrem, který zapíná.
     *
     * Nálepka je krátká („Bez webu") na přání majitele 20. 9. 2026 — tvrzení o firmách, které
     * doložit neumíme, proto `hint` (tooltip sekce) i chip filtru dál říkají pravdu: web jsme
     * nenašli. Od 20. 9. 2026 kliknutí na sekci podmínky NAHRADÍ (viz `applyScenario`), takže se
     * k ní už nepřilepí „Mám jak oslovit" z profilu, které dřív dalo 0 z 500 firem.
     */
    label: { cs: 'Bez webu', sk: 'Bez webu', en: 'No website' },
    action: { cs: 'Najít firmy bez webu', sk: 'Nájsť firmy bez webu', en: 'Find firms without a website' },
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
    /**
     * Výchozí scénář pro tvůrce webů. Samotné „web jsme nenašli" vrací seznam, na který se nedá
     * zavolat: kontakty sbíráme z webu firmy, takže firma bez webu obvykle nemá ani telefon
     * (změřeno 18. 9. 2026 na 500 firmách ze Zlínského kraje: ze 404 bez webu 0 s kontaktem).
     * Tenhle scénář přidá podmínku „mám jak oslovit", takže zbydou firmy, které jde oslovit
     * a zároveň jim web chybí nebo pokulhává.
     */
    id: 'reach_weak_web',
    icon: 'globe',
    forWhom: { cs: 'tvůrci webů', sk: 'tvorcovia webov', en: 'web developers' },
    label: { cs: 'Jde oslovit a web pokulhává', sk: 'Dá sa osloviť a web pokuľháva', en: 'Reachable, weak website' },
    action: { cs: 'Najít firmy s kontaktem a slabým webem', sk: 'Nájsť firmy s kontaktom a slabým webom', en: 'Find reachable firms with a weak website' },
    hint: {
      cs: 'Firmy, na které máme telefon, e-mail nebo profil na síti, a jejichž web jsme nenašli nebo propadl v auditu. Tohle je seznam, který jde rovnou obvolat.',
      sk: 'Firmy, na ktoré máme telefón, e-mail alebo profil na sieti, a ktorých web sme nenašli alebo prepadol v audite. Toto je zoznam, ktorý sa dá rovno obvolať.',
      en: 'Firms we have a phone, e-mail or social profile for, whose website we did not find or which failed the audit. A list you can start calling.',
    },
    filters: ['can_reach', 'weak_web'],
  },
  {
    /**
     * Firma, která si udržuje sítě, ale web nemá nebo ho zanedbala: ví, že viditelnost má cenu,
     * a je co jí nabídnout. Nejsilnější signál „chce růst", který máme bez placených zdrojů.
     */
    id: 'social_weak_web',
    icon: 'social',
    forWhom: { cs: 'tvůrci webů, marketéři', sk: 'tvorcovia webov, marketéri', en: 'web developers, marketers' },
    label: { cs: 'Aktivní na sítích, web slabý', sk: 'Aktívne na sieťach, web slabý', en: 'Active on social, weak website' },
    action: { cs: 'Najít firmy ze sítí se slabým webem', sk: 'Nájsť firmy zo sietí so slabým webom', en: 'Find social-active firms with a weak website' },
    hint: {
      cs: 'Firmy s profilem na Facebooku, Instagramu nebo LinkedInu, kterým web chybí nebo propadl v auditu. O viditelnost se starají, takže vědí, proč web potřebují.',
      sk: 'Firmy s profilom na Facebooku, Instagrame alebo LinkedIne, ktorým web chýba alebo prepadol v audite. O viditeľnosť sa starajú, takže vedia, prečo web potrebujú.',
      en: 'Firms with a Facebook, Instagram or LinkedIn profile whose website is missing or failed the audit. They already invest in visibility, so they know why they need a site.',
    },
    filters: ['has_social', 'weak_web'],
  },
  {
    id: 'old_web',
    icon: 'shield',
    forWhom: { cs: 'tvůrci webů', sk: 'tvorcovia webov', en: 'web developers' },
    label: { cs: 'Firmy se zastaralým webem', sk: 'Firmy so zastaraným webom', en: 'Firms with a dated website' },
    action: { cs: 'Najít firmy se zastaralým webem', sk: 'Nájsť firmy so zastaraným webom', en: 'Find firms with a dated website' },
    hint: {
      cs: 'Firmy s ověřeným webem, který běží bez HTTPS — prohlížeč u něj návštěvníkovi píše „Nezabezpečeno".',
      sk: 'Firmy s overeným webom, ktorý beží bez HTTPS — prehliadač pri ňom návštevníkovi píše „Nezabezpečené".',
      en: 'Firms with a verified website served without HTTPS — the browser tells their visitors it is “not secure”.',
    },
    filters: ['insecure_website'],
  },
  {
    id: 'ads_no_web',
    icon: 'megaphone',
    forWhom: { cs: 'tvůrci webů, marketéři', sk: 'tvorcovia webov, marketéri', en: 'web developers, marketers' },
    label: { cs: 'Platí za reklamu, web nemá', sk: 'Platí za reklamu, web nemá', en: 'Pays for ads, has no website' },
    action: { cs: 'Najít inzerenty bez webu', sk: 'Nájsť inzerentov bez webu', en: 'Find advertisers without a website' },
    hint: {
      cs: 'Firmy z Meta Knihovny reklam, jejichž reklamy nevedou na web a my jsme web nenašli. Vyžaduje přístup k Ad Library API; spárování s inzerentem se povede jen u části firem.',
      sk: 'Firmy z Meta Knižnice reklám, ktorých reklamy nevedú na web a my sme web nenašli. Vyžaduje prístup k Ad Library API; spárovanie s inzerentom sa podarí len pri časti firiem.',
      en: 'Firms from the Meta Ad Library whose ads do not link to a website and where we found none. Needs Ad Library API access; matching succeeds only for some firms.',
    },
    filters: ['ads_no_web'],
  },
  {
    id: 'new',
    icon: 'sparkles',
    forWhom: { cs: 'účetní, pojišťováci, právníci', sk: 'účtovníci, poisťováci, právnici', en: 'accountants, insurers, lawyers' },
    label: { cs: 'Nové firmy', sk: 'Nové firmy', en: 'New firms' },
    action: { cs: 'Najít nové firmy', sk: 'Nájsť nové firmy', en: 'Find new firms' },
    hint: {
      cs: 'Firmy zapsané do rejstříku během posledního půlroku, v celém kraji. Vybírají se z indexu RES ČSÚ, jméno a sídlo doplní ARES — datum vzniku je přesné.',
      sk: 'Firmy zapísané do registra počas posledného polroka, v celom kraji. Vyberajú sa z indexu RES ČSÚ, meno a sídlo doplní ARES — dátum vzniku je presný.',
      en: 'Firms entered in the register within the last six months, across the whole region. They come from the Czech Statistical Office index; ARES fills in name and address — the date is exact.',
    },
    filters: ['new_firm_6m'],
  },
  {
    id: 'reach',
    icon: 'phone',
    forWhom: { cs: 'kdokoli, kdo volá a píše', sk: 'ktokoľvek, kto volá a píše', en: 'anyone who calls and writes' },
    label: { cs: 'Jde oslovit', sk: 'Dá sa osloviť', en: 'Reachable' },
    action: { cs: 'Najít firmy s kontaktem', sk: 'Nájsť firmy s kontaktom', en: 'Find reachable firms' },
    hint: {
      cs: 'Jen firmy, na které máme telefon, e-mail, profil na síti nebo kontaktní stránku. Ostatní se v seznamu neukážou.',
      sk: 'Len firmy, na ktoré máme telefón, e-mail, profil na sieti alebo kontaktnú stránku. Ostatné sa v zozname neukážu.',
      en: 'Only firms we have a phone, e-mail, social profile or contact page for. The rest do not appear.',
    },
    filters: ['can_reach'],
  },
  {
    /**
     * Režim „Ubytování a wellness" (majitel 26. 9. 2026): penziony, apartmány, chaty, kempy,
     * privátní sauny a wellness bez vlastního webu — přicházejí o přímé rezervace a platí
     * Bookingu provizi. Zdroje jsou stejné jako jinde (ARES podle NACE a názvu, OpenStreetMap
     * podle `tourism` / `leisure`); Google Places v EHP pro tohle použít nesmíme a Booking ani
     * Airbnb se nečtou. Pořadí dává `opportunityScore` (kontakt, chybějící web, plátce DPH,
     * provozovny, stáří firmy).
     */
    id: 'stay',
    icon: 'bed',
    forWhom: { cs: 'tvůrci webů s rezervacemi', sk: 'tvorcovia webov s rezerváciami', en: 'booking-site builders' },
    label: { cs: 'Ubytování a wellness bez webu', sk: 'Ubytovanie a wellness bez webu', en: 'Stays and wellness without a website' },
    hint: {
      cs: 'Penziony, apartmány, chaty, kempy a wellness, u kterých jsme vlastní web nenašli — nebo mají jen Facebook či Instagram.',
      sk: 'Penzióny, apartmány, chaty, kempy a wellness, pri ktorých sme vlastný web nenašli — alebo majú len Facebook či Instagram.',
      en: 'Guest houses, apartments, chalets, camp sites and wellness where we found no own website — or only Facebook or Instagram.',
    },
    action: { cs: 'Najít ubytování a wellness bez webu', sk: 'Nájsť ubytovanie a wellness bez webu', en: 'Find stays and wellness without a website' },
    filters: ['no_web_found'],
    industries: ['hotel', 'wellness'],
  },
];

/** Sekce na přehledu a v hlavičce hledání — čtyři vstupy, které pokryjí většinu profesí. */
export const FEATURED_SCENARIOS = ['reach_weak_web', 'social_weak_web', 'stay', 'new', 'reach'] as const;

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
  web: 'reach_weak_web',
  marketing: 'old_web',
  finance: 'new',
  legal: 'all',
  b2b: 'all',
  other: 'all',
};
