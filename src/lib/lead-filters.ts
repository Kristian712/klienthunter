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

/** A page slower than this to first byte reads as slow. Used by a filter and by the UI. */
export const SLOW_WEBSITE_MS = 2_500;

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
  /**
   * True when we actually had a page to read the social links off. Three `false`s on a row we
   * never opened mean "we did not look", not "the firm has no profiles".
   */
  socialsChecked?: boolean | null;
}

export type FilterGroup = 'web' | 'contact' | 'company';

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
}

export const GROUP_LABELS: Record<FilterGroup, { cs: string; sk?: string; en: string }> = {
  company: { cs: 'Firma',   sk: 'Firma',   en: 'Company' },
  contact: { cs: 'Kontakt', sk: 'Kontakt', en: 'Contact' },
  web:     { cs: 'Web',     sk: 'Web',     en: 'Website' },
};

/**
 * Company first, website last. The website group used to lead because the product was about
 * firms without one; it is now one property among many and must not be the first thing a
 * photographer or an accountant reads.
 */
export const GROUP_ORDER: FilterGroup[] = ['company', 'contact', 'web'];

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

/** No founding date means no opinion about the firm's age — only ARES ever supplies one. */
const ageUnknown = (b: FilterableLead) => yearsSince(b.foundedAt) === null;

/** `vatPayer` is filled by the DPH enrichment; null means that lookup never returned. */
const vatUnknown = (b: FilterableLead) => b.vatPayer === null || b.vatPayer === undefined;

export const LEAD_FILTERS: LeadFilter[] = [
  {
    id: 'no_website',
    group: 'web',
    /**
     * The wording is the whole point. "Web neuveden" was read as a statement about the firm, and
     * for most rows it was false — ARES has no website column and OpenStreetMap tags one on a
     * minority of what it maps, so the app was calling firms websiteless on the strength of
     * having never looked. This label says who did the not-finding.
     */
    label: { cs: 'Web jsme nenašli', sk: 'Web sme nenašli', en: 'We found no website' },
    where: STATUS_NOT_HAS,
    test: b => webStatusOf(b) !== 'HAS',
    /**
     * And this is what keeps the score honest. As a chip the filter is a work queue and may
     * hand back everything unconfirmed; as a *criterion* it is the claim "this firm has no
     * website", which today no source can support. Half credit, never a confirmed match, never
     * printed in the "Proč" column as a reason the firm ranked where it did.
     */
    unknown: b => webStatusOf(b) === 'UNKNOWN',
  },
  {
    id: 'has_website',
    group: 'web',
    label: { cs: 'Má web', sk: 'Má web', en: 'Has website' },
    where: STATUS_HAS,
    test: b => webStatusOf(b) === 'HAS',
    // Symmetrically: a row we never resolved is not a firm that demonstrably lacks a website.
    unknown: b => webStatusOf(b) === 'UNKNOWN',
  },
  {
    id: 'slow_website',
    group: 'web',
    label: { cs: `Pomalý web (${SLOW_WEBSITE_MS / 1000}s+)`, sk: `Pomalý web (${SLOW_WEBSITE_MS / 1000}s+)`, en: `Slow website (${SLOW_WEBSITE_MS / 1000}s+)` },
    where: { websiteMs: { gte: SLOW_WEBSITE_MS } },
    test: b => typeof b.websiteMs === 'number' && b.websiteMs >= SLOW_WEBSITE_MS,
    // A page we never timed is not a fast page. Nationwide runs skip every probe.
    unknown: b => typeof b.websiteMs !== 'number',
  },
  {
    id: 'old_website',
    group: 'web',
    label: { cs: 'Zastaralý web', sk: 'Zastaraný web', en: 'Outdated website' },
    where: { websiteIsOld: true },
    test: b => Boolean(b.websiteIsOld),
    // You cannot call a site outdated if you never found the site.
    unknown: b => !b.websiteIsOld && webStatusOf(b) !== 'HAS',
  },
  {
    id: 'has_contact',
    group: 'contact',
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
    group: 'contact',
    label: { cs: 'Bez telefonu i e-mailu', sk: 'Bez telefónu aj e-mailu', en: 'No phone or e-mail' },
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
    label: { cs: 'Má telefon', sk: 'Má telefón', en: 'Has phone' },
    where: { NOT: [{ phone: null }, { phone: '' }] },
    test: b => Boolean(b.phone),
  },
  {
    id: 'has_email',
    group: 'contact',
    label: { cs: 'Má e-mail', sk: 'Má e-mail', en: 'Has e-mail' },
    where: { NOT: [{ email: null }, { email: '' }] },
    test: b => Boolean(b.email),
  },
  {
    id: 'no_social',
    group: 'contact',
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
    id: 'no_category',
    group: 'company',
    label: { cs: 'Bez uvedeného oboru', sk: 'Bez uvedeného odboru', en: 'No trade listed' },
    where: { OR: [{ category: null }, { category: '' }] },
    test: b => !b.category,
  },
  {
    id: 'new_firm',
    group: 'company',
    // The entry date in ARES is exact, so "founded in the last year" is one of the few things
    // we can state without hedging. It is the whole lead list for an accountant or a bookkeeper.
    label: { cs: 'Nová firma (do 1 roku)', sk: 'Nová firma (do 1 roka)', en: 'New firm (under 1 year)' },
    where: { foundedAt: { gt: foundedBefore(1) } },
    test: youngerThan(1),
    unknown: ageUnknown,
  },
  {
    id: 'established_3y',
    group: 'company',
    label: { cs: 'Firma 3+ roky', sk: 'Firma 3+ roky', en: '3+ years old' },
    where: { foundedAt: { lte: foundedBefore(3) } },
    test: olderThan(3),
    unknown: ageUnknown,
  },
  {
    id: 'established_10y',
    group: 'company',
    label: { cs: 'Firma 10+ let', sk: 'Firma 10+ rokov', en: '10+ years old' },
    where: { foundedAt: { lte: foundedBefore(10) } },
    test: olderThan(10),
    unknown: ageUnknown,
  },
  {
    id: 'vat_payer',
    group: 'company',
    label: { cs: 'Plátce DPH', sk: 'Platiteľ DPH', en: 'VAT registered' },
    where: { vatPayer: true },
    test: b => b.vatPayer === true,
    unknown: vatUnknown,
  },
  {
    id: 'vat_none',
    group: 'company',
    label: { cs: 'Neplátce DPH', sk: 'Neplatiteľ DPH', en: 'Not VAT registered' },
    where: { vatPayer: false },
    test: b => b.vatPayer === false,
    unknown: vatUnknown,
  },
  {
    id: 'vat_unreliable',
    group: 'company',
    label: { cs: 'Nespolehlivý plátce', sk: 'Nespoľahlivý platiteľ', en: 'Unreliable VAT payer' },
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
