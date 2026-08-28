import dns from 'node:dns/promises';
import { normalizeName, probeWebsite, type ProbeResult, type RobotsCheck } from './website-status';

/**
 * Finding the firm's own website when no source named one.
 *
 * Why this exists: ARES has no website column and OpenStreetMap tags one on a small minority of
 * what it maps — for a search like "zubaři v Ostravě" that means 206 firms and zero websites,
 * while the first name typed into a search engine turns one up in seconds. Saying nothing was
 * honest but useless; the fix is to actually go and look.
 *
 * The danger is obvious and is the reason this module is so cautious: a guessed domain that
 * happens to answer would attach a stranger's website to a firm, which is exactly the confident
 * wrong answer the app must never produce. So a guess is only ever a question, and only the
 * fetched page can answer it:
 *
 *   • the firm's IČO printed on the page — decisive, nobody else prints that number, or
 *   • every word of the firm's name found on the page, on a domain built out of that same name.
 *
 * Anything less and we stay quiet. Measured on 60 real Ostrava dental practices from ARES this
 * confirms a website for about one in five and produced no false match; the domains it walked
 * away from (ostrava.cz for "EuroDent Ostrava", centrum.cz for "TRT zubní centrum",
 * ordinace.cz for "o.dent zubní ordinace") are exactly the ones a looser rule would have
 * printed as facts.
 */

/** Words that describe a trade rather than name a firm, so they can never be a domain by themselves. */
const GENERIC_WORDS = new Set([
  'ordinace', 'klinika', 'centrum', 'studio', 'salon', 'servis', 'sluzby', 'praxe', 'poradna',
  'atelier', 'group', 'company', 'firma', 'shop', 'store', 'czech', 'ceska', 'ceske', 'cesky',
  'morava', 'praha', 'brno', 'ostrava', 'plzen', 'olomouc', 'liberec', 'bratislava', 'kosice',
  'dental', 'dentalni', 'denta', 'dent', 'zubni', 'zubar', 'stomatologie', 'medicina', 'estetika',
  'esteticka', 'doktor', 'lekar', 'smile', 'profi', 'plus', 'prvni', 'nova', 'nove', 'novy',
  'restaurace', 'kavarna', 'pekarna', 'reznictvi', 'kadernictvi', 'kosmetika', 'masaze',
  'autoservis', 'pneuservis', 'instalater', 'elektro', 'elektrikar', 'truhlarstvi', 'zamecnictvi',
  'stavby', 'staveb', 'reality', 'realitni', 'advokat', 'advokatni', 'ucetnictvi', 'ucetni',
  'fitness', 'sport', 'design', 'media', 'online', 'system', 'systemy', 'trade', 'invest',
]);

/** Academic and professional titles — part of a person's name, never part of a domain. */
const TITLES = /\b(mudr|mddr|mvdr|judr|ing|mgr|bc|phdr|rndr|paeddr|prof|doc|csc|ph\s*d)\b\.?/g;

/** Country the search runs in decides which TLD a firm would have registered. */
const TLD_BY_COUNTRY: Array<[RegExp, string]> = [
  [/slovakia|slovensk/i, 'sk'],
  [/germany|deutschland|německ|nemeck/i, 'de'],
  [/austria|rakous/i, 'at'],
  [/\bUK\b|united kingdom|británi|britani/i, 'co.uk'],
  [/\bUSA\b|united states/i, 'com'],
  [/poland|polsk/i, 'pl'],
];

export function tldForRegion(region: string): string {
  for (const [re, tld] of TLD_BY_COUNTRY) if (re.test(region)) return tld;
  return 'cz';
}

/**
 * How often each word occurs across the whole result set.
 *
 * This is what tells "ajna" apart from "dental" without anyone maintaining a list per trade: in
 * a search for dentists half the names contain "dental", and exactly one contains "ajna". The
 * static list above only covers the words that would be generic even in a set of one.
 */
export interface NameIndex {
  df: Map<string, number>;
  size: number;
}

export function buildNameIndex(names: string[]): NameIndex {
  const df = new Map<string, number>();
  for (const name of names) {
    for (const token of Array.from(new Set(nameTokens(name)))) df.set(token, (df.get(token) ?? 0) + 1);
  }
  return { df, size: names.length };
}

/** The firm's name reduced to plain words: no legal form, no titles, no diacritics. */
export function nameTokens(name: string): string[] {
  return normalizeName(name.replace(/"[^"]*"/g, ' '))
    .replace(TITLES, ' ')
    .split(' ')
    .filter(t => t.length >= 2);
}

/** A word specific enough that a domain made of it alone could plausibly be this firm's. */
function isDistinctive(token: string, index: NameIndex): boolean {
  if (token.length < 4 || GENERIC_WORDS.has(token)) return false;
  const ceiling = Math.max(2, Math.ceil(index.size * 0.02));
  return (index.df.get(token) ?? 0) <= ceiling;
}

const MIN_SLUG = 4;
const MAX_SLUG = 40;
export const MAX_DOMAINS_PER_FIRM = 4;

/**
 * Domains worth asking about, best first.
 *
 * The whole name joined up is always fair game — `dentalnistudiokpd.cz` cannot belong to anybody
 * else. Shortened forms are only built from a distinctive word, which is what keeps this from
 * proposing `centrum.cz` for "TRT zubní centrum".
 */
export function domainCandidates(name: string, index: NameIndex, tld: string): string[] {
  const tokens = nameTokens(name);
  if (tokens.length === 0) return [];
  const distinctive = tokens.filter(t => isDistinctive(t, index));

  const slugs: string[] = [];
  const push = (slug: string) => {
    if (slug.length >= MIN_SLUG && slug.length <= MAX_SLUG && !slugs.includes(slug)) slugs.push(slug);
  };

  // "G A Dent s.r.o." reduces to the single word "dent", and `dent.cz` is a portal, not that
  // firm. A domain that is nothing but the name of the trade can never identify anybody.
  const identifying = tokens.filter(t => !GENERIC_WORDS.has(t));
  if (identifying.length === 0) return [];

  push(tokens.join(''));
  if (tokens.length > 1) push(tokens.join('-'));
  // "AJNA dental clinic" is known as ajnadental; the tail of a long name is usually dropped.
  if (tokens.length > 2 && distinctive.some(d => tokens.slice(0, 2).includes(d))) {
    push(tokens.slice(0, 2).join(''));
    push(tokens.slice(0, 2).join('-'));
  }
  for (const token of distinctive) if (token.length >= 5) push(token);

  return slugs.slice(0, MAX_DOMAINS_PER_FIRM).map(s => `${s}.${tld}`);
}

/** Cheap filter: an unregistered domain costs one UDP round trip instead of a five-second probe. */
async function resolvable(domain: string): Promise<boolean> {
  try {
    await dns.resolve4(domain);
    return true;
  } catch {
    /* fall through to IPv6 — some hosts are AAAA-only */
  }
  try {
    await dns.resolve6(domain);
    return true;
  } catch {
    return false;
  }
}

/** Readable text of a page, lowercased and stripped of diacritics, markup and scripts. */
export function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Whole-word test on the flattened page text.
 *
 * `String.includes` was not enough and the difference was not academic: "MUDr. Lukáš Mer" ended
 * up matched to `lukas.cz` because the three letters of "mer" occur inside `komerční`. A name is
 * only on a page when it is there as a word.
 */
export function hasWord(text: string, word: string): boolean {
  if (!word) return false;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text);
}

/** Registrar placeholders answer 200 with a page that is nobody's website. */
const PARKED = /(je na prodej|na predaj|for sale|parkovan[aáéy]|zaregistrujte si|under construction|website coming soon)/i;

/** The label a domain is known by, hyphens removed, so `kovac-dental` compares with the name. */
function domainLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').split('.')[0].replace(/-/g, '');
  } catch {
    return '';
  }
}

export interface DiscoveredSite {
  url: string;
  html?: string;
  elapsedMs?: number;
  /** Czech sentence naming what convinced us, shown in the row's tooltip and in exports. */
  evidence: string;
}

/**
 * Decides whether a page that answered belongs to this firm. Returns the reason, or `null` when
 * the page proves nothing — which is the default and the safe answer.
 */
export function verifyPage(
  html: string,
  firm: { name: string; ico?: string },
  url: string,
  index: NameIndex,
  /** Words of the trade the user searched for, already normalised. May be empty. */
  tradeWords: readonly string[] = [],
): string | null {
  const text = pageText(html);
  if (PARKED.test(text)) return null;

  // IČO is issued by the state and printed by nobody else. On its own it settles the question.
  if (firm.ico && text.replace(/[^0-9]/g, '').includes(firm.ico)) {
    return `na stránce je IČO ${firm.ico}`;
  }

  const tokens = nameTokens(firm.name).filter(t => t.length >= 3);
  if (tokens.length === 0 || !tokens.every(t => hasWord(text, t))) return null;
  // At least one word has to name *this* firm rather than its trade — see `domainCandidates`.
  if (!tokens.some(t => !GENERIC_WORDS.has(t))) return null;

  // The name is on the page — but so is "restaurace" on every restaurant's page. It only counts
  // when the domain was built out of that same name rather than out of the trade.
  const label = domainLabel(url);
  const wholeNameIsTheDomain = tokens.every(t => label.includes(t));
  const distinctiveOnPage = tokens.some(t => isDistinctive(t, index) && label.includes(t));
  if (!wholeNameIsTheDomain && !distinctiveOnPage) return null;

  /**
   * Second, independent fact: the page has to be about the trade the user searched.
   *
   * A firm called after a person is where a name match alone breaks down — half of OpenStreetMap's
   * dentists are mapped as "Pokorný", and `pokorny.cz` says "Pokorný" on it whoever owns it. The
   * trade is what separates that dentist's site from a builder of the same surname, and it costs
   * nothing: we already know what the user typed into the search box.
   */
  if (tradeWords.length > 0 && !tradeWords.some(w => text.includes(w))) return null;

  return 'doména nese název firmy, celý název i obor sedí na stránce';
}

/**
 * Looks for the firm's website among the domains its name suggests.
 *
 * Never throws and never runs past `deadlineAt`: a search that ran out of time simply reports
 * nothing, exactly as it did before this module existed.
 */
export async function discoverWebsite(
  firm: { name: string; ico?: string },
  index: NameIndex,
  opts: {
    tld: string;
    deadlineAt: number;
    /** Injected so this shares the pipeline's robots.txt cache and per-host memo. */
    probe: (url: string) => Promise<ProbeResult>;
    /** Words of the searched trade; a page that mentions none of them is somebody else's. */
    tradeWords?: readonly string[];
  },
): Promise<DiscoveredSite | null> {
  const domains = domainCandidates(firm.name, index, opts.tld);
  if (domains.length === 0) return null;

  // One batch of DNS lookups for the whole firm: they are cheap, independent, and knowing which
  // domains exist at all decides how many expensive probes are left to run.
  const registered: string[] = [];
  await Promise.all(
    domains.map(async d => {
      if (await resolvable(d)) registered.push(d);
    }),
  );

  for (const domain of domains) {
    if (!registered.includes(domain)) continue;
    // Checked before every probe, not once: four dead hosts at five seconds each would otherwise
    // eat the budget the rest of the search needs.
    if (Date.now() >= opts.deadlineAt) return null;

    const result = await opts.probe(`https://${domain}`);
    // Blocked by robots.txt means a site exists but we may not read it — and without reading it
    // we cannot show it belongs to this firm, so it stays unsaid.
    if (!result.alive || !result.html) continue;

    const url = result.finalUrl ?? `https://${domain}`;
    const why = verifyPage(result.html, firm, url, index, opts.tradeWords ?? []);
    if (why) {
      return { url, html: result.html, elapsedMs: result.elapsedMs, evidence: `web dohledán podle názvu firmy: ${why}` };
    }
  }

  return null;
}

/** Exported for the pipeline, which needs a probe that is not memoised per host. */
export async function probeOnce(url: string, robots?: RobotsCheck): Promise<ProbeResult> {
  return probeWebsite(url, robots);
}
