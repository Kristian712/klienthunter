import { localized } from './lead-filters';

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
  professionText: string | null;
  targetIndustry: string | null;
  targetRegion: string | null;
  targetCity: string | null;
  /** Ids from LEAD_FILTERS. */
  targetFilters: string[];
  onboardedAt: string | null;
}

export const EMPTY_PROFILE: UserProfile = {
  name: null,
  profession: null,
  professionText: null,
  targetIndustry: null,
  targetRegion: null,
  targetCity: null,
  targetFilters: [],
  onboardedAt: null,
};

export interface Profession {
  id: string;
  label: { cs: string; sk?: string; en: string };
  /**
   * Tři obory, které se téhle profesi nabídnou hned na první obrazovce.
   *
   * Není to doporučení, koho oslovovat — na to aplikace data nemá. Je to zkratka k prvnímu
   * hledání, aby člověk nemusel vybírat ze čtyřiceti oborů dřív, než vůbec uvidí, co mu
   * aplikace vrátí. Kdykoli si vybere jiný.
   */
  industries: string[];
  /**
   * Criteria pre-ticked in step four for this trade. A starting point the user can change, not
   * a claim about what their clients need — every id here is something the public data actually
   * tells us, and the user sees each one spelled out before they continue.
   */
  suggests: string[];
}

/**
 * Deliberately broad and deliberately ending in "something else". The list exists to make the
 * common cases one click, not to tell anyone their trade is not on it.
 */
export const PROFESSIONS: Profession[] = [
  {
    id: 'web',
    label: { cs: 'Tvorba webů', sk: 'Tvorba webov', en: 'Web design' },
    industries: ['hair salon', 'restaurant', 'car repair'],
    suggests: ['no_website', 'has_contact'],
  },
  {
    id: 'marketing',
    label: { cs: 'Marketing a reklama', sk: 'Marketing a reklama', en: 'Marketing and advertising' },
    industries: ['restaurant', 'hair salon', 'gym'],
    suggests: ['no_social', 'has_contact'],
  },
  {
    id: 'accounting',
    label: { cs: 'Účetnictví a daně', sk: 'Účtovníctvo a dane', en: 'Accounting and tax' },
    industries: ['builder', 'freight', 'hair salon'],
    suggests: ['new_firm', 'has_contact'],
  },
  {
    id: 'photo',
    label: { cs: 'Fotografie a video', sk: 'Fotografia a video', en: 'Photography and video' },
    industries: ['restaurant', 'hotel', 'hair salon'],
    suggests: ['has_contact', 'no_social'],
  },
  {
    id: 'realestate',
    label: { cs: 'Reality', sk: 'Reality', en: 'Real estate' },
    industries: ['builder', 'hotel', 'restaurant'],
    suggests: ['established_3y', 'has_contact'],
  },
  {
    id: 'legal',
    label: { cs: 'Právní služby', sk: 'Právne služby', en: 'Legal services' },
    industries: ['builder', 'freight', 'restaurant'],
    suggests: ['new_firm', 'has_contact'],
  },
  {
    id: 'cleaning',
    label: { cs: 'Úklid a údržba', sk: 'Upratovanie a údržba', en: 'Cleaning and maintenance' },
    industries: ['restaurant', 'hotel', 'gym'],
    suggests: ['has_contact', 'established_3y'],
  },
  {
    id: 'it',
    label: { cs: 'IT podpora', sk: 'IT podpora', en: 'IT support' },
    industries: ['accountant', 'lawyer', 'dentist'],
    suggests: ['has_contact', 'established_3y'],
  },
  {
    id: 'consulting',
    label: { cs: 'Poradenství a školení', sk: 'Poradenstvo a školenia', en: 'Consulting and training' },
    industries: ['restaurant', 'car repair', 'builder'],
    suggests: ['has_contact', 'established_3y'],
  },
  {
    // Doplněno ve vlně 5: pojišťováci a finanční poradci jsou jedna z profesí, pro které se
    // tahle aplikace staví, a v seznamu chyběli. Hledají čerstvě vzniklé firmy, protože ty
    // ještě nemají nic sjednané.
    id: 'finance',
    label: { cs: 'Finance a pojištění', sk: 'Financie a poistenie', en: 'Finance and insurance' },
    industries: ['freight', 'builder', 'restaurant'],
    suggests: ['new_firm_6m', 'has_contact'],
  },
  {
    id: 'other',
    label: { cs: 'Něco jiného', sk: 'Niečo iné', en: 'Something else' },
    industries: ['restaurant', 'hair salon', 'car repair'],
    suggests: ['has_contact'],
  },
];

const BY_ID = new Map(PROFESSIONS.map(p => [p.id, p]));

export function professionById(id?: string | null): Profession | undefined {
  return id ? BY_ID.get(id) : undefined;
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
