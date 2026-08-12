import { SLOW_WEBSITE_MS, yearsSince } from './lead-score';

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
 */

/** The subset of a result row the client-side predicates need. */
export interface FilterableLead {
  websiteStatus?: string | null;
  hasWebsite?: boolean | null;
  websiteIsOld?: boolean | null;
  websiteMs?: number | null;
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
}

export type FilterGroup = 'web' | 'contact' | 'company';

export interface LeadFilter {
  id: string;
  group: FilterGroup;
  label: { cs: string; en: string };
  /** Prisma `BusinessResultWhereInput`, typed loosely so this module stays Prisma-free. */
  where: Record<string, unknown>;
  test: (b: FilterableLead) => boolean;
}

export const GROUP_LABELS: Record<FilterGroup, { cs: string; en: string }> = {
  web:     { cs: 'Web',    en: 'Website' },
  contact: { cs: 'Kontakt', en: 'Contact' },
  company: { cs: 'Firma',   en: 'Company' },
};

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
const STATUS_UNKNOWN = {
  OR: [{ websiteStatus: 'UNKNOWN' }, { websiteStatus: null, hasWebsite: false }],
};
const STATUS_HAS = {
  OR: [{ websiteStatus: 'HAS' }, { websiteStatus: null, hasWebsite: true }],
};

function hasSocial(b: FilterableLead): boolean {
  return Boolean(b.hasFacebook || b.hasInstagram || b.hasLinkedIn);
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

export const LEAD_FILTERS: LeadFilter[] = [
  {
    id: 'no_website',
    group: 'web',
    label: { cs: 'Web neuveden', en: 'No website found' },
    // Deliberately UNKNOWN, not NONE. Since the directory sources were removed, nothing can
    // prove a business has no site, so NONE is empty and this is the bucket worth selling to.
    where: STATUS_UNKNOWN,
    test: b => webStatusOf(b) === 'UNKNOWN',
  },
  {
    id: 'has_website',
    group: 'web',
    label: { cs: 'Má web', en: 'Has website' },
    where: STATUS_HAS,
    test: b => webStatusOf(b) === 'HAS',
  },
  {
    id: 'slow_website',
    group: 'web',
    label: { cs: `Pomalý web (${SLOW_WEBSITE_MS / 1000}s+)`, en: `Slow website (${SLOW_WEBSITE_MS / 1000}s+)` },
    where: { websiteMs: { gte: SLOW_WEBSITE_MS } },
    test: b => typeof b.websiteMs === 'number' && b.websiteMs >= SLOW_WEBSITE_MS,
  },
  {
    id: 'old_website',
    group: 'web',
    label: { cs: 'Zastaralý web', en: 'Outdated website' },
    where: { websiteIsOld: true },
    test: b => Boolean(b.websiteIsOld),
  },
  {
    id: 'no_contact',
    group: 'contact',
    label: { cs: 'Bez telefonu i e-mailu', en: 'No phone or e-mail' },
    where: {
      AND: [
        { OR: [{ phone: null }, { phone: '' }] },
        { OR: [{ email: null }, { email: '' }] },
      ],
    },
    test: b => !b.phone && !b.email,
  },
  {
    id: 'has_phone',
    group: 'contact',
    label: { cs: 'Má telefon', en: 'Has phone' },
    where: { NOT: [{ phone: null }, { phone: '' }] },
    test: b => Boolean(b.phone),
  },
  {
    id: 'has_email',
    group: 'contact',
    label: { cs: 'Má e-mail', en: 'Has e-mail' },
    where: { NOT: [{ email: null }, { email: '' }] },
    test: b => Boolean(b.email),
  },
  {
    id: 'no_social',
    group: 'contact',
    label: { cs: 'Bez sociálních sítí', en: 'No social profiles' },
    where: { hasFacebook: false, hasInstagram: false, hasLinkedIn: false },
    test: b => !hasSocial(b),
  },
  {
    id: 'no_category',
    group: 'company',
    label: { cs: 'Bez uvedeného oboru', en: 'No trade listed' },
    where: { OR: [{ category: null }, { category: '' }] },
    test: b => !b.category,
  },
  {
    id: 'established_3y',
    group: 'company',
    label: { cs: 'Firma 3+ roky', en: '3+ years old' },
    where: { foundedAt: { lte: foundedBefore(3) } },
    test: olderThan(3),
  },
  {
    id: 'established_10y',
    group: 'company',
    label: { cs: 'Firma 10+ let', en: '10+ years old' },
    where: { foundedAt: { lte: foundedBefore(10) } },
    test: olderThan(10),
  },
  {
    id: 'vat_payer',
    group: 'company',
    label: { cs: 'Plátce DPH', en: 'VAT registered' },
    where: { vatPayer: true },
    test: b => b.vatPayer === true,
  },
  {
    id: 'vat_none',
    group: 'company',
    label: { cs: 'Neplátce DPH', en: 'Not VAT registered' },
    where: { vatPayer: false },
    test: b => b.vatPayer === false,
  },
  {
    id: 'vat_unreliable',
    group: 'company',
    label: { cs: 'Nespolehlivý plátce', en: 'Unreliable VAT payer' },
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
