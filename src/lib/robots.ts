import axios from 'axios';
import robotsParser from 'robots-parser';

/**
 * Identifies us honestly and points at a page explaining what the bot does. Anonymous
 * browser-spoofing is what got Firmy.cz scraping ruled out; there is no reason to repeat it
 * on the sites we are allowed to visit.
 */
export const CRAWLER_UA = 'KlientHunterBot/1.0 (+https://klienthunter.vercel.app/robot)';

const FETCH_TIMEOUT = 4_000;
const MAX_ROBOTS_BYTES = 100_000;

export interface RobotsVerdict {
  allowed: boolean;
  /** Seconds the site asks callers to wait between requests, if it says so. */
  crawlDelay?: number;
  reason: string;
}

type Rules = ReturnType<typeof robotsParser> | null;

async function fetchRobots(origin: string): Promise<{ rules: Rules; blanketDeny: boolean }> {
  try {
    const res = await axios.get(`${origin}/robots.txt`, {
      timeout: FETCH_TIMEOUT,
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      maxRedirects: 3,
      responseType: 'text',
      transformResponse: [(d: string) => d],
      validateStatus: () => true,
      headers: { 'User-Agent': CRAWLER_UA },
    });

    // The convention the major crawlers follow: a missing file means "help yourself",
    // a server error means "come back later", so only 5xx blocks us.
    if (res.status >= 500) return { rules: null, blanketDeny: true };
    if (res.status !== 200 || typeof res.data !== 'string') return { rules: null, blanketDeny: false };

    const body = res.data.slice(0, MAX_ROBOTS_BYTES);
    return { rules: robotsParser(`${origin}/robots.txt`, body), blanketDeny: false };
  } catch {
    // A site we cannot reach is not a site that granted permission, but treating an outage as
    // a refusal would silently empty every search. Allow, and let the probe itself fail.
    return { rules: null, blanketDeny: false };
  }
}

/**
 * One robots.txt per host per request. Returns a checker that never throws.
 */
export function createRobotsCache() {
  const cache = new Map<string, Promise<{ rules: Rules; blanketDeny: boolean }>>();

  return async (rawUrl: string): Promise<RobotsVerdict> => {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return { allowed: false, reason: 'neplatná adresa' };
    }

    const origin = url.origin;
    let pending = cache.get(origin);
    if (!pending) {
      pending = fetchRobots(origin);
      cache.set(origin, pending);
    }

    const { rules, blanketDeny } = await pending;
    if (blanketDeny) return { allowed: false, reason: 'server robots.txt nevydal (5xx)' };
    if (!rules) return { allowed: true, reason: 'web robots.txt nemá' };

    const allowed = rules.isAllowed(url.toString(), CRAWLER_UA) ?? true;
    return {
      allowed,
      crawlDelay: rules.getCrawlDelay(CRAWLER_UA) ?? undefined,
      reason: allowed ? 'robots.txt to povoluje' : 'web zakazuje automatické stahování (robots.txt)',
    };
  };
}
