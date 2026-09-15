import { LEAD_FILTERS, localized } from './lead-filters';

/**
 * Who the user is and who they are hunting — the answers to the onboarding modal.
 *
 * The app used to assume everyone sold websites. It now asks instead, once, and remembers: the
 * search form arrives pre-filled on every later visit, and the lead score ranks by the criteria
 * chosen here (see `lead-score.ts`).
 *
 * Nothing in here is required. A user who skips the modal still gets a working product — an
 * empty profile simply means "rank by the neutral default".
 */

export interface UserProfile {
  name: string | null;
  profession: string | null;
  /** The answer as originally given, before professions were merged into six profiles. */
  professionRaw: string | null;
  professionText: string | null;
  /** Answer to the profile's follow-up question, when it has one. An id from `followUp.options`. */
  clientType: string | null;
  targetIndustry: string | null;
  targetRegion: string | null;
  /** Ids from LEAD_FILTERS. */
  targetFilters: string[];
  onboardedAt: string | null;
}

export const EMPTY_PROFILE: UserProfile = {
  name: null,
  profession: null,
  professionRaw: null,
  professionText: null,
  clientType: null,
  targetIndustry: null,
  targetRegion: null,
  targetFilters: [],
  onboardedAt: null,
};

export interface FollowUpOption {
  id: string;
  label: { cs: string; sk?: string; en: string };
  /** Replaces the profile's `presetFilters` when chosen. */
  presetFilters: string[];
  /** Replaces the profile's `industries` when chosen; omitted = keep the profile's. */
  industries?: string[];
}

export interface Profession {
  id: string;
  label: { cs: string; sk?: string; en: string };
  /** One line under the label in the questionnaire — what the presets mean, no promises. */
  note?: { cs: string; sk?: string; en: string };
  /**
   * Tři až čtyři obory, které se téhle profesi nabídnou hned na první obrazovce.
   *
   * Není to doporučení, koho oslovovat — na to aplikace data nemá. Je to zkratka k prvnímu
   * hledání, aby člověk nemusel vybírat ze čtyřiceti oborů dřív, než vůbec uvidí, co mu
   * aplikace vrátí. Kdykoli si vybere jiný.
   */
  industries: string[];
  /**
   * Filtry (chipy), které hledání zapne předem. Uživatel je vidí označené jako přednastavené
   * a jedním tlačítkem je vypne — je to výchozí stav, ne omezení.
   */
  presetFilters: string[];
  /**
   * Criteria pre-ticked for this trade. A starting point the user can change, not a claim about
   * what their clients need — every id here is something the public data actually tells us, and
   * the user sees each one spelled out before they continue.
   */
  suggests: string[];
  /** Second question of the questionnaire. Only where it changes the presets meaningfully. */
  followUp?: {
    question: { cs: string; sk?: string; en: string };
    options: FollowUpOption[];
  };
}

/**
 * Šest profilů místo jedenácti profesí (12. 9. 2026).
 *
 * Jedenáct chipů na jedno kliknutí bylo moc a půlka z nich sdílela tytéž výchozí hodnoty. Sloučení
 * jde po tom, co člověk u firem hledá, ne po názvu jeho oboru: účetní, pojišťovák i finanční
 * poradce chtějí čerstvě založené firmy, právník a konzultant zavedené s DPH.
 *
 * Schválně tu nejsou řemesla. Aplikace hledá firmy, ne domácnosti — zedník ani instalatér tady
 * svoje zákazníky nenajde a název profilu mu to nesmí slibovat. Kdo si vybere „Něco jiného" a
 * napíše řemeslo, dostane neutrální výchozí hodnoty a nic navíc.
 *
 * `presetFilters` slibují jen to, co filtry umí doložit: „Web jsme nenašli" místo „Web nemá"
 * (to je bez vyhledávače prázdné), stáří firmy a DPH z ARESu, kontakt z toho, co zdroje vrátily.
 * Velikost firmy appka nezná, takže ji žádný profil nepředstírá.
 */
export const PROFESSIONS: Profession[] = [
  {
    id: 'web',
    label: { cs: 'Tvorba webů a IT', sk: 'Tvorba webov a IT', en: 'Web design and IT' },
    note: {
      cs: 'Filtr „Web jsme nenašli“ zahrnuje i firmy, u kterých se web nepodařilo ověřit.',
      sk: 'Filter „Web sme nenašli“ zahŕňa aj firmy, pri ktorých sa web nepodarilo overiť.',
      en: 'The “We found no website” filter includes firms whose site could not be verified.',
    },
    industries: ['hair salon', 'restaurant', 'car repair', 'plumber'],
    presetFilters: ['no_web_found', 'working'],
    suggests: ['no_web_found', 'has_contact'],
    followUp: {
      question: { cs: 'Co nabízíte?', sk: 'Čo ponúkate?', en: 'What do you offer?' },
      options: [
        {
          id: 'new_sites',
          label: { cs: 'Nové weby', sk: 'Nové weby', en: 'New websites' },
          presetFilters: ['no_web_found', 'working'],
        },
        {
          id: 'redesign',
          label: { cs: 'Předělání starých webů', sk: 'Prerobenie starých webov', en: 'Redesigning old sites' },
          presetFilters: ['old_website', 'working'],
        },
        {
          id: 'it_care',
          label: { cs: 'IT správu a podporu', sk: 'IT správu a podporu', en: 'IT management and support' },
          presetFilters: ['has_website', 'established_3y', 'working'],
          industries: ['accountant', 'lawyer', 'dentist', 'real estate agency'],
        },
      ],
    },
  },
  {
    id: 'marketing',
    label: { cs: 'Marketing, foto a video', sk: 'Marketing, foto a video', en: 'Marketing, photo and video' },
    industries: ['restaurant', 'cafe', 'beauty salon', 'gym'],
    presetFilters: ['has_website', 'no_social', 'working'],
    suggests: ['no_social', 'has_contact'],
  },
  {
    id: 'finance',
    label: { cs: 'Finance, pojištění a účetnictví', sk: 'Financie, poistenie a účtovníctvo', en: 'Finance, insurance and accounting' },
    industries: ['freight', 'builder', 'car repair', 'hair salon'],
    presetFilters: ['new_firm', 'can_reach', 'working'],
    suggests: ['new_firm_6m', 'vat_none', 'has_contact'],
    followUp: {
      question: { cs: 'Koho oslovujete nejčastěji?', sk: 'Koho oslovujete najčastejšie?', en: 'Who do you approach most often?' },
      options: [
        {
          id: 'new_firms',
          label: { cs: 'Nové firmy (do roka)', sk: 'Nové firmy (do roka)', en: 'New firms (under a year)' },
          presetFilters: ['new_firm', 'can_reach', 'working'],
        },
        {
          id: 'established',
          label: { cs: 'Zavedené firmy', sk: 'Zavedené firmy', en: 'Established firms' },
          presetFilters: ['established_3y', 'vat_payer', 'can_reach', 'working'],
        },
        {
          id: 'sole_traders',
          label: { cs: 'Živnostníky', sk: 'Živnostníkov', en: 'Sole traders' },
          presetFilters: ['can_reach', 'working'],
          industries: ['plumber', 'electrician', 'hair salon', 'car repair'],
        },
      ],
    },
  },
  {
    id: 'legal',
    label: { cs: 'Právní služby a poradenství', sk: 'Právne služby a poradenstvo', en: 'Legal services and consulting' },
    industries: ['builder', 'freight', 'restaurant', 'real estate agency'],
    presetFilters: ['established_3y', 'can_reach', 'working'],
    suggests: ['established_3y', 'vat_payer', 'has_contact'],
  },
  {
    id: 'b2b',
    label: { cs: 'Služby a dodávky pro firmy', sk: 'Služby a dodávky pre firmy', en: 'Services and supplies for businesses' },
    industries: ['restaurant', 'hotel', 'gym', 'dentist'],
    presetFilters: ['established_3y', 'has_phone', 'working'],
    suggests: ['established_3y', 'has_phone'],
  },
  {
    id: 'other',
    label: { cs: 'Něco jiného', sk: 'Niečo iné', en: 'Something else' },
    industries: ['restaurant', 'hair salon', 'car repair'],
    presetFilters: ['working'],
    suggests: ['has_contact'],
  },
];

/**
 * Stará id profesí → nový profil. `professionRaw` drží původní hodnotu, aby se nezapomnělo, kdo
 * si vybral účetnictví a kdo právo, i když dnes sedí v jednom profilu.
 */
export const LEGACY_PROFESSION: Record<string, string> = {
  accounting: 'finance',
  photo: 'marketing',
  realestate: 'b2b',
  cleaning: 'b2b',
  it: 'web',
  consulting: 'legal',
};

const BY_ID = new Map(PROFESSIONS.map(p => [p.id, p]));

/**
 * Přednastavení jsou odkazy do katalogu filtrů (`LEAD_FILTERS`), ne vlastní definice — nový
 * filtr v katalogu jde hned použít v profilu a obě strany se nemůžou rozejít. Tahle kontrola
 * to hlídá při načtení modulu: neznámé id je chyba v kódu, ne stav dat.
 */
(function assertPresetsInCatalog() {
  const known = new Set(LEAD_FILTERS.map(f => f.id));
  const missing: string[] = [];
  for (const p of PROFESSIONS) {
    const ids = [...p.presetFilters, ...p.suggests, ...(p.followUp?.options.flatMap(o => o.presetFilters) ?? [])];
    for (const id of ids) if (!known.has(id)) missing.push(`${p.id}:${id}`);
  }
  if (missing.length === 0) return;
  const message = `profile.ts: přednastavení odkazují na filtry, které v katalogu nejsou: ${missing.join(', ')}`;
  if (process.env.NODE_ENV !== 'production') throw new Error(message);
  console.error(message);
})();

/** Current profile id for a stored value — legacy ids map onto the merged profiles. */
export function normalizeProfession(id?: string | null): string | null {
  if (!id) return null;
  if (BY_ID.has(id)) return id;
  return LEGACY_PROFESSION[id] ?? null;
}

export function professionById(id?: string | null): Profession | undefined {
  const normalized = normalizeProfession(id);
  return normalized ? BY_ID.get(normalized) : undefined;
}

/** The follow-up option the user picked, if the profile has that question. */
export function followUpOption(profile: Pick<UserProfile, 'profession' | 'clientType'>): FollowUpOption | undefined {
  const p = professionById(profile.profession);
  if (!p?.followUp || !profile.clientType) return undefined;
  return p.followUp.options.find(o => o.id === profile.clientType);
}

/**
 * Filters the search should start with for this profile. Empty when the user never answered —
 * an unanswered questionnaire must not change what the search does.
 */
export function presetFiltersFor(profile: Pick<UserProfile, 'profession' | 'clientType'>): string[] {
  const p = professionById(profile.profession);
  if (!p) return [];
  return followUpOption(profile)?.presetFilters ?? p.presetFilters;
}

/** Industries to offer as shortcuts, honouring the follow-up answer. */
export function industriesFor(profile: Pick<UserProfile, 'profession' | 'clientType'>): string[] {
  const p = professionById(profile.profession);
  if (!p) return [];
  return followUpOption(profile)?.industries ?? p.industries;
}

/** What to call the user's trade on screen — their own words win over our list. */
export function professionLabel(profile: UserProfile, locale: string): string | null {
  if (profile.profession === 'other') return profile.professionText?.trim() || null;
  const found = professionById(profile.profession);
  return found ? localized(found.label, locale) : null;
}

/** True once the user has told us enough that a search can be pre-filled for them. */
export function hasSearchDefaults(profile: UserProfile): boolean {
  return Boolean(profile.targetIndustry && profile.targetRegion);
}
