import axios from 'axios';

export type WebsiteStatus = 'HAS' | 'NONE' | 'UNKNOWN';

export interface WebsiteSignals {
  /** Non-social URL reported by a source (OSM `website` tag, an uploaded CSV column). */
  claimedUrl?: string;
  /**
   * The business is mapped in OSM with contact details but carries no website tag. Weak:
   * OSM contributors record what they can see on the door, and a missing tag is far more
   * often an unmapped detail than a business with no site.
   */
  osmSaysEmpty?: boolean;
  /** A registry record exists and lists no website. Weightless — ARES has no website field. */
  registryHasNoField?: boolean;
}

export interface WebsiteVerdict {
  status: WebsiteStatus;
  url?: string;
  evidence: string;
  /** Response time of the verified page in ms. Only set when we actually loaded it. */
  elapsedMs?: number;
  /** HTML of the verified page, so callers can score it without a second request. */
  html?: string;
}

export interface ProbeResult {
  alive: boolean;
  finalUrl?: string;
  httpStatus?: number;
  html?: string;
  reason: string;
  /**
   * Milliseconds until the server sent its response headers — not a Lighthouse score, but the
   * one honest speed number a single request can produce, and enough to spot a site that keeps
   * a visitor waiting. Absent when nothing answered or when robots.txt kept us out.
   */
  elapsedMs?: number;
  /** The host served a robots.txt that forbids us. Proof the site exists, not that it is dead. */
  blockedByRobots?: boolean;
}

/** Injected so the probe can respect robots.txt without this module importing the fetcher. */
export type RobotsCheck = (url: string) => Promise<{ allowed: boolean; reason: string }>;

const PROBE_TIMEOUT = 5_000;
const MAX_HTML = 500_000;
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const SOCIAL_DOMAINS = [
  'facebook.com', 'fb.com', 'fb.me',
  'instagram.com',
  'linkedin.com',
  'twitter.com', 'x.com',
  'tiktok.com',
  'youtube.com', 'youtu.be',
  'pinterest.com',
  'wa.me', 'whatsapp.com',
  'maps.google.com', 'goo.gl', 'maps.app.goo.gl',
  'firmy.cz', 'najisto.cz', 'zlatestranky.cz',
];

/** True when the URL points at a real site rather than a social profile or a directory listing. */
export function isRealWebsite(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return !SOCIAL_DOMAINS.some(d => host === d || host.endsWith('.' + d));
  } catch {
    return false;
  }
}

export function socialFromUrl(url: string): { fb?: string; ig?: string; li?: string } {
  if (!url) return {};
  const u = url.toLowerCase();
  if (u.includes('facebook.com') || u.includes('fb.com')) return { fb: url };
  if (u.includes('instagram.com')) return { ig: url };
  if (u.includes('linkedin.com')) return { li: url };
  return {};
}

// ── Matching helpers ──────────────────────────────────────────────────────────

/** Last 9 digits, which is what makes Czech numbers comparable across formats. */
export function normalizePhone(phone: string | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : '';
}

const LEGAL_FORMS = /\b(s\s*\.?\s*r\s*\.?\s*o|a\s*\.?\s*s|spol|v\s*\.?\s*o\s*\.?\s*s|z\s*\.?\s*s|o\s*\.?\s*p\s*\.?\s*s|k\s*\.?\s*s)\b\.?/g;

/** Google pads names with taglines after `|` or `–`; strip those before comparing. */
export function normalizeName(name: string | undefined): string {
  if (!name) return '';
  return name
    .split(/[|–—]/)[0]
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(LEGAL_FORMS, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Industry words that must never be the sole reason to merge two records. */
const GENERIC_TOKENS = new Set([
  'instalater', 'elektrikar', 'autoservis', 'kadernictvi', 'restaurace', 'kavarna',
  'pekarna', 'reznictvi', 'zamecnictvi', 'kominictvi', 'uklid', 'uklidova', 'servis',
  'studio', 'salon', 'nails', 'nail', 'brno', 'praha', 'ostrava', 'firma', 'company',
  'sluzby', 'group', 'centrum', 'shop', 'store', 'cz', 'the', 'and',
]);

/** Exported so callers can index candidates by token instead of comparing every pair. */
export function significantTokens(name: string): string[] {
  return normalizeName(name).split(' ').filter(t => t.length >= 3 && !GENERIC_TOKENS.has(t));
}

/**
 * Two records describe the same business when the phone matches AND the names share a
 * significant token, or when the names alone are a distinctive match. A shared phone by
 * itself is not enough — switchboards and franchise branches reuse numbers.
 */
export function isSameBusiness(
  a: { name?: string; phone?: string; ico?: string },
  b: { name?: string; phone?: string; ico?: string },
): boolean {
  // IČO is a state-issued identifier — when both sides have one it settles the question
  // outright, in both directions. Nothing below can override it.
  if (a.ico && b.ico) return a.ico === b.ico;

  const phoneA = normalizePhone(a.phone);
  const phoneB = normalizePhone(b.phone);
  const tokensA = significantTokens(a.name ?? '');
  const tokensB = significantTokens(b.name ?? '');
  const sharesToken = tokensA.some(t => tokensB.includes(t));

  if (phoneA && phoneA === phoneB) return sharesToken;

  const nameA = normalizeName(a.name);
  const nameB = normalizeName(b.name);
  if (nameA.length >= 5 && nameA === nameB) return true;

  return sharesToken && tokensA.length > 0 && tokensB.length > 0 &&
    (nameA.startsWith(nameB) || nameB.startsWith(nameA));
}

// ── HTTP probe ────────────────────────────────────────────────────────────────

function urlVariants(raw: string): string[] {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return [];
  }

  const variants = [parsed.toString()];

  // Try the other www form — some hosts serve only one of them.
  const swapped = new URL(parsed.toString());
  swapped.hostname = swapped.hostname.startsWith('www.')
    ? swapped.hostname.slice(4)
    : 'www.' + swapped.hostname;
  variants.push(swapped.toString());

  // Fall back to http for hosts with a broken or missing certificate.
  if (parsed.protocol === 'https:') {
    const insecure = new URL(parsed.toString());
    insecure.protocol = 'http:';
    variants.push(insecure.toString());
  }

  return Array.from(new Set(variants));
}

/**
 * Reads at most `MAX_HTML` bytes and hangs up. `maxContentLength` cannot do this — it aborts
 * the request instead, which would turn every page over the cap into a dead domain.
 */
async function readCapped(stream: NodeJS.ReadableStream): Promise<string | undefined> {
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      chunks.push(chunk);
      size += chunk.length;
      if (size >= MAX_HTML) break;
    }
  } catch {
    if (chunks.length === 0) return undefined;
  } finally {
    (stream as unknown as { destroy?: () => void }).destroy?.();
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function attempt(url: string): Promise<ProbeResult | null> {
  const startedAt = Date.now();
  try {
    const res = await axios.get(url, {
      timeout: PROBE_TIMEOUT,
      // A stalled DNS lookup never trips the axios timer, so bound the whole call too.
      signal: AbortSignal.timeout(PROBE_TIMEOUT),
      maxRedirects: 5,
      responseType: 'stream',
      validateStatus: () => true,
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'cs,en;q=0.9',
      },
    });

    const finalUrl: string = res.request?.res?.responseUrl ?? url;
    // Measured before the body is drained on purpose: reading up to 500 kB over a slow link
    // would blame the server for our own download.
    const elapsedMs = Date.now() - startedAt;

    if (res.status < 400) {
      return {
        alive: true,
        finalUrl,
        httpStatus: res.status,
        elapsedMs,
        html: await readCapped(res.data),
        reason: `web odpověděl ${res.status} za ${elapsedMs} ms`,
      };
    }

    (res.data as unknown as { destroy?: () => void }).destroy?.();
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      return { alive: true, finalUrl, httpStatus: res.status, elapsedMs, reason: `web žije, ale blokuje boty (${res.status})` };
    }
    return null;
  } catch {
    return null;
  }
}

/** Tries https/http and both www forms. Never throws. */
export async function probeWebsite(url: string, robots?: RobotsCheck): Promise<ProbeResult> {
  if (robots) {
    const verdict = await robots(url);
    if (!verdict.allowed) {
      // Serving a robots.txt at all means the host is up, so this is a live site we simply
      // may not read. Reporting it as dead would be both wrong and rude.
      return { alive: true, finalUrl: url, blockedByRobots: true, reason: verdict.reason };
    }
  }

  for (const variant of urlVariants(url)) {
    const result = await attempt(variant);
    if (result) return result;
  }
  return { alive: false, reason: 'doména neodpověděla' };
}

// ── Classification ────────────────────────────────────────────────────────────

/**
 * Weight at which absence is considered proven.
 *
 * Since the directory sources were removed on legal grounds, no remaining source produces
 * strong enough evidence to reach this on its own — which is the honest answer: a public
 * registry that has no website field cannot tell you a business has no website. In practice
 * verdicts are now HAS or UNKNOWN, and UNKNOWN is the bucket worth selling to. The threshold
 * stays so that a future source with real negative evidence slots straight in.
 */
const NONE_THRESHOLD = 3;

/**
 * Turns collected signals into a verdict. A probe result is passed in separately so the
 * caller controls whether verification happened at all (it is skipped for nationwide runs).
 *
 * The one rule that must never bend: uncertainty resolves to UNKNOWN, never to NONE.
 */
export function classify(signals: WebsiteSignals, probe?: ProbeResult): WebsiteVerdict {
  const { claimedUrl } = signals;

  if (claimedUrl && isRealWebsite(claimedUrl)) {
    if (!probe) {
      return { status: 'HAS', url: claimedUrl, evidence: 'zdroj uvádí web (neověřeno HTTP)' };
    }
    if (probe.blockedByRobots) {
      // A host that bothers to publish a robots.txt is a host with a website. We may not read
      // the page, so it goes unscored — but calling it unverified would push a firm that
      // demonstrably has a site into the bucket we pitch new websites to.
      return {
        status: 'HAS',
        url: probe.finalUrl ?? claimedUrl,
        evidence: `web existuje, ale ${probe.reason} – stránku jsme nestahovali`,
      };
    }
    if (probe.alive) {
      return {
        status: 'HAS',
        url: probe.finalUrl ?? claimedUrl,
        evidence: probe.reason,
        elapsedMs: probe.elapsedMs,
        html: probe.html,
      };
    }
    // The source claims a site but nothing answered. That is not proof of absence.
    return { status: 'UNKNOWN', url: claimedUrl, evidence: `zdroj uvádí web, ale ${probe.reason}` };
  }

  let weight = 0;
  const reasons: string[] = [];

  if (claimedUrl) {
    reasons.push('v poli web je odkaz na sociální síť');
  }
  if (signals.osmSaysEmpty) {
    weight += 1;
    reasons.push('v OpenStreetMap je firma bez odkazu na web');
  }
  if (signals.registryHasNoField) {
    // Deliberately weightless: ARES has no website column, so its silence says nothing at all.
    reasons.push('registr web neeviduje');
  }

  if (weight >= NONE_THRESHOLD) {
    return { status: 'NONE', evidence: reasons.join(', ') };
  }
  return {
    status: 'UNKNOWN',
    evidence: reasons.length ? `nedoloženo: ${reasons.join(', ')}` : 'žádný zdroj web nepotvrdil ani nevyvrátil',
  };
}

/** Rows saved before three-state classification carry NULL — a stored `false` proved nothing. */
export function resolveStatus(row: { websiteStatus?: string | null; hasWebsite: boolean }): WebsiteStatus {
  if (row.websiteStatus === 'HAS' || row.websiteStatus === 'NONE' || row.websiteStatus === 'UNKNOWN') {
    return row.websiteStatus;
  }
  return row.hasWebsite ? 'HAS' : 'UNKNOWN';
}

/** Keeps the strongest evidence when the same business arrives from several sources. */
export function mergeVerdicts(a: WebsiteVerdict, b: WebsiteVerdict): WebsiteVerdict {
  const rank = (s: WebsiteStatus) => (s === 'HAS' ? 2 : s === 'NONE' ? 1 : 0);
  return rank(b.status) > rank(a.status) ? b : a;
}

// ── Concurrency ───────────────────────────────────────────────────────────────

/**
 * Worker pool with a wall-clock deadline. Tasks queued after the deadline are skipped
 * rather than started, so one dead domain can never hold up the whole search.
 */
export async function runPool<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
  deadlineAt: number,
  onSkipped: (item: T) => R,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const worker = async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      if (Date.now() >= deadlineAt) {
        results[index] = onSkipped(items[index]);
        continue;
      }
      try {
        results[index] = await fn(items[index]);
      } catch {
        results[index] = onSkipped(items[index]);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

/** Per-request memo so franchise branches sharing a domain cost one probe. */
export function createProbeCache(robots?: RobotsCheck) {
  const cache = new Map<string, Promise<ProbeResult>>();
  return (url: string): Promise<ProbeResult> => {
    let key: string;
    try {
      key = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      key = url;
    }
    const hit = cache.get(key);
    if (hit) return hit;
    const pending = probeWebsite(url, robots);
    cache.set(key, pending);
    return pending;
  };
}
