import axios from 'axios';

export type WebsiteStatus = 'HAS' | 'NONE' | 'UNKNOWN';

export interface WebsiteSignals {
  /** Non-social URL reported by a source (OSM `website` tag, an uploaded CSV column). */
  claimedUrl?: string;
  /**
   * The firm's own mail domain, turned into a URL — see `siteFromEmail`. Not a claim by any
   * source, so on its own it proves nothing; it only becomes a verdict once the probe confirms
   * that the domain actually serves a page.
   */
  emailDomainUrl?: string;
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
  /** HTML of the verified page, so callers can score it without a second request. */
  html?: string;
}

export interface ProbeResult {
  alive: boolean;
  finalUrl?: string;
  httpStatus?: number;
  html?: string;
  reason: string;
  /** The host served a robots.txt that forbids us. Proof the site exists, not that it is dead. */
  blockedByRobots?: boolean;
}

/** Injected so the probe can respect robots.txt without this module importing the fetcher. */
export type RobotsCheck = (url: string) => Promise<{ allowed: boolean; reason: string }>;

/**
 * Limit jednoho HTTP dotazu na cizí web.
 *
 * Bylo 5 s. Změřeno na hledání autoservisů v Libereckém kraji: 38 požadavků z 941 (4 %) ten
 * limit vyčerpalo a spolykalo 190 s z celkových 479 s — necelá čtyři procenta dotazů stála
 * čtyřicet procent času. Dvě sekundy stačí na server, který odpovídá; server, který za dvě
 * sekundy nezvedne, je buď mrtvý, nebo tak pomalý, že je to samo o sobě odpověď.
 *
 * Cena: přijdeme o weby na opravdu líných serverech. U nich ale platí, že pomalý web je přesně
 * ten, kvůli kterému uživatel firmu oslovuje — takže i tak zůstane ve výsledku, jen bez adresy.
 */
/**
 * Kolik čekáme na odpověď webu.
 *
 * Byly to 2 s, zkrácené kvůli 60s stropu serverové funkce. Hledání dnes běží na pozadí, kde
 * strop není — a dvě vteřiny stačily jen na rychlé weby: ESTHEA medical odpověděla za 3 s
 * a vycházela jako firma bez webu.
 */
const PROBE_TIMEOUT = 6_000;
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

/**
 * Mailbox providers, which say nothing about a website.
 *
 * The distinction this list draws is the whole point of `siteFromEmail`: `info@seznam.cz` is a
 * free mailbox anyone can open, while `info@klempirstvi-novak.cz` means the firm registered and
 * pays for that domain. The second is worth checking for a website; the first is not.
 */
const FREEMAIL_DOMAINS = [
  'seznam.cz', 'email.cz', 'centrum.cz', 'volny.cz', 'post.cz', 'atlas.cz', 'tiscali.cz',
  'quick.cz', 'chello.cz', 'iol.cz', 'razdva.cz', 'inmail.cz',
  'centrum.sk', 'azet.sk', 'zoznam.sk', 'pobox.sk', 'szm.sk',
  'googlemail.com', 'icloud.com', 'me.com', 'mac.com',
  'proton.me', 'protonmail.com', 'protonmail.ch', 'pm.me',
  'web.de', 'freemail.hu', 'mail.ru', 'yandex.ru',
  'zoho.com', 'fastmail.com', 'mailbox.org',
];

/**
 * The same thing, but for providers that run a mailbox on dozens of country domains — Microsoft
 * alone has `outlook.com`, `outlook.cz`, `outlook.sk`, `outlook.co.uk` and more. Enumerating every
 * one is a losing game, so these match on the first label whatever the TLD.
 *
 * It costs us the occasional real firm that happens to be called "Live s.r.o." on `live.cz`. That
 * is the cheap mistake: we simply say nothing about its website. The expensive mistake is the
 * other way round — probing `outlook.co.uk`, finding it alive, and telling the user that
 * Microsoft's login page is the firm's website. That is exactly the lie this whole change exists
 * to kill, so the doubt gets resolved against ourselves.
 */
const FREEMAIL_BRANDS = [
  'gmail', 'outlook', 'hotmail', 'live', 'msn', 'yahoo', 'ymail', 'rocketmail',
  'gmx', 'aol', 'inbox', 'mail', 'email', 'seznam', 'centrum', 'azet', 'zoznam',
];

/**
 * The firm's own website, derived from the domain it takes mail on.
 *
 * This exists because our sources know contact details far better than they know websites:
 * ARES has no website column at all and OpenStreetMap carries a `website` tag on only a
 * fraction of the businesses it maps. A firm that publishes `info@example.cz` has told us it
 * owns `example.cz` — that is a fact from the data, not a guess about a name.
 *
 * Deliberately *not* guessing a domain from the company name. Turning "Klempířství Novák" into
 * `klempirstvi-novak.cz` and probing it would sooner or later attach a stranger's website to a
 * firm, which is precisely the kind of confident wrong answer this app must never produce.
 *
 * Returns a URL to *check*, never a verdict. See `classify`: it only counts once a probe has
 * confirmed the domain serves something.
 */
export function siteFromEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;
  const at = email.lastIndexOf('@');
  // `at < 1` and not `at < 0`: "@nic.cz" has no local part, so it is not an address at all and
  // whoever owns nic.cz never told us anything.
  if (at < 1) return undefined;

  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/[.,;:>)\]]+$/, '');

  // Must look like a hostname with a TLD. Anything else is a malformed address, not a domain.
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
    return undefined;
  }

  const isUnder = (list: readonly string[]) =>
    list.some(d => domain === d || domain.endsWith('.' + d));
  if (isUnder(FREEMAIL_DOMAINS)) return undefined;
  // A Facebook page is not a website, and it is not one when it arrives as a mail domain either.
  if (isUnder(SOCIAL_DOMAINS)) return undefined;
  if (FREEMAIL_BRANDS.includes(brandLabel(domain))) return undefined;

  return `https://${domain}`;
}

/** Second-level domains that behave like a TLD, so the name people pay for sits one label left. */
const PSEUDO_TLDS = ['co', 'com', 'net', 'org', 'ac', 'gov', 'edu', 'or', 'ne'];

/**
 * The label a domain is actually known by: `outlook` in `outlook.co.uk`, but `firma` in
 * `mail.firma.cz` — a company's own mail server, which must not be mistaken for the provider
 * `mail.ru`. Approximated without the public suffix list, which is a dependency and a download
 * this one check does not justify.
 */
function brandLabel(domain: string): string {
  const parts = domain.split('.');
  if (parts.length < 2) return domain;
  const take = parts.length > 2 && PSEUDO_TLDS.includes(parts[parts.length - 2]) ? 3 : 2;
  return parts[parts.length - take];
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

/**
 * Kolik podob adresy zkoušet.
 *
 * `all` je pro adresy, které uvedl zdroj: ty jsou skoro jistě správné, jen mohou být zapsané
 * v jiné podobě, takže stojí za to zkusit i `www.` a `http://`. `first-only` je pro domény,
 * které jsme uhodli z názvu firmy — tam je hypotéza samotná nejistá a tři pokusy na každou
 * z nich znamenaly 2,7 požadavku na doménu a většinu celkového času.
 */
export type ProbeVariants = 'all' | 'first-only';

function urlVariants(raw: string, mode: ProbeVariants = 'all'): string[] {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return [];
  }

  const variants = [parsed.toString()];
  if (mode === 'first-only') return variants;

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

    if (res.status < 400) {
      return {
        alive: true,
        finalUrl,
        httpStatus: res.status,
        html: await readCapped(res.data),
        reason: `web odpověděl ${res.status}`,
      };
    }

    (res.data as unknown as { destroy?: () => void }).destroy?.();
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      return { alive: true, finalUrl, httpStatus: res.status, reason: `web žije, ale blokuje boty (${res.status})` };
    }
    return null;
  } catch {
    return null;
  }
}

/** Tries https/http and both www forms. Never throws. */
export async function probeWebsite(
  url: string,
  robots?: RobotsCheck,
  mode: ProbeVariants = 'all',
): Promise<ProbeResult> {
  if (robots) {
    const verdict = await robots(url);
    if (!verdict.allowed) {
      // Serving a robots.txt at all means the host is up, so this is a live site we simply
      // may not read. Reporting it as dead would be both wrong and rude.
      return { alive: true, finalUrl: url, blockedByRobots: true, reason: verdict.reason };
    }
  }

  /**
   * Odpověď bez HTML smyčku neukončí.
   *
   * Doména, která vrátí 403, je „živá", ale nepřečetli jsme z ní ani slovo — a přesně to dělá
   * profservis.cz: holá doména blokuje boty, `www.` servíruje web s IČO firmy. Dokud se
   * `attempt` bral jako konečná odpověď, `www.` se nikdy nezkusilo a firma s živým webem
   * vycházela jako firma bez webu. Blokovanou odpověď si proto necháme stranou a vrátíme ji,
   * jen když žádná další podoba adresy nedá stránku ke čtení.
   */
  let blokovano: ProbeResult | null = null;
  for (const variant of urlVariants(url, mode)) {
    const result = await attempt(variant);
    if (!result) continue;
    if (result.html) return result;
    blokovano ??= result;
  }
  return blokovano ?? { alive: false, reason: 'doména neodpověděla' };
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
        html: probe.html,
      };
    }
    /**
     * The source claims a site but nothing answered. That is not proof of absence — and it is
     * not proof of a website either, which is why the URL does **not** travel with this verdict.
     *
     * It used to. The row then landed in the database with `websiteStatus: 'UNKNOWN'` and a
     * filled-in `website` column at the same time, and those two fields have different readers:
     * the "web jsme nenašli" filter looks at the status, the results table prints the address.
     * So a firm showed up in a list of firms without a website with its web address next to it,
     * clickable. Measured on one search for restaurants in Brno: 21 of the 240 rows that passed
     * the filter, and 156 rows across the whole database.
     *
     * The address itself is not lost — it goes into the evidence, which is where a claim we
     * could not confirm belongs. `website` from now on means one thing only: a page we loaded.
     */
    return { status: 'UNKNOWN', evidence: `zdroj uvádí web ${claimedUrl}, ale ${probe.reason}` };
  }

  // No source named a website, but the firm takes mail on a domain of its own and that domain
  // answers. The domain is theirs and the page is real, so the page is their website — the same
  // standard of proof as a claimed URL that we loaded, reached from a different direction.
  //
  // The probe is not optional here. Without it this is only an inference, and an inference is
  // exactly what must not be printed as a fact.
  if (signals.emailDomainUrl && probe?.alive) {
    return probe.blockedByRobots
      ? {
          status: 'HAS',
          url: probe.finalUrl ?? signals.emailDomainUrl,
          evidence: `web na doméně z e-mailu firmy, ${probe.reason} – stránku jsme nestahovali`,
        }
      : {
          status: 'HAS',
          url: probe.finalUrl ?? signals.emailDomainUrl,
          evidence: `web na doméně z e-mailu firmy, ${probe.reason}`,
          html: probe.html,
        };
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
  if (signals.emailDomainUrl && probe) {
    // Also weightless. Plenty of firms run mail on a domain that serves no page, and plenty of
    // servers refuse us while serving everyone else.
    reasons.push('doména z e-mailu firmy neodpověděla');
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

/**
 * Per-request memo so franchise branches sharing a domain cost one probe.
 *
 * Klíčem je jen hostitel, ne režim variant. Když tentýž hostitel přijde jednou jako uhodnutá
 * doména a podruhé jako adresa ze zdroje, vyhraje první výsledek — což je správně: druhý dotaz
 * na stejný server by nic nového nezjistil a jen bychom ho obtěžovali.
 */
export function createProbeCache(robots?: RobotsCheck) {
  const cache = new Map<string, Promise<ProbeResult>>();
  return (url: string, mode: ProbeVariants = 'all'): Promise<ProbeResult> => {
    let key: string;
    try {
      key = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      key = url;
    }
    const hit = cache.get(key);
    if (hit) return hit;
    const pending = probeWebsite(url, robots, mode);
    cache.set(key, pending);
    return pending;
  };
}
