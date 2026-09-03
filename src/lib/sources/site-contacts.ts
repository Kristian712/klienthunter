import type { RawLead } from './types';

/**
 * Pulls a contact out of HTML the website probe has already downloaded. This costs no extra
 * request and touches no page the probe was not allowed to fetch, so the robots.txt decision
 * made upstream carries over automatically.
 *
 * Only addresses on the firm's own domain are kept. A page full of `@gmail.com` links is
 * usually the web designer's footer or a customer testimonial, not the business.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const TEL_RE = /(?:\+420[\s.-]?)?(?:\d{3}[\s.-]?){2}\d{3}/g;

/** Addresses that belong to the platform or the agency, never to the business itself. */
const JUNK_LOCALPARTS = /^(no-?reply|noreply|donotreply|example|your|email|name|user|test)$/i;
const JUNK_DOMAINS = [
  'sentry.io', 'wixpress.com', 'shoptet.cz', 'webnode.com', 'squarespace.com',
  'wordpress.com', 'godaddy.com', 'example.com', 'domain.com', 'email.com',
];

function registrableHost(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function scoreEmail(email: string, siteHost: string): number {
  const [local, domain] = email.toLowerCase().split('@');
  if (!domain || JUNK_LOCALPARTS.test(local)) return -1;
  if (JUNK_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))) return -1;
  if (/\.(png|jpe?g|gif|svg|webp|css|js)$/.test(domain)) return -1;

  // Same domain as the site is the strongest signal that this is the business's own address.
  if (siteHost && (domain === siteHost || domain.endsWith('.' + siteHost))) {
    return /^(info|kontakt|obchod|office|mail|sales|podpora)$/.test(local) ? 3 : 2;
  }
  return 0;
}

/**
 * Telefon v jednom tvaru: `+420 123 456 789`.
 *
 * Používá se na dvě věci naráz — na čísla vyzobaná z webu a na tagy z OpenStreetMap, které
 * chodí v jakémkoli tvaru (`+420577599786`, `777717998`, `+42020777157655`). Když jsou v jednom
 * poli čísla dvě (`723 634 984, 724 563 687`), bere se první: spojit je dohromady by dalo číslo,
 * které nepatří nikomu.
 */
export function normalizeCzPhone(raw: string): string | null {
  for (const part of raw.split(/[,;/]|\bnebo\b|\balebo\b/i)) {
    const digits = part.replace(/\D/g, '');
    if (!digits) continue;
    // Předvolba se odstraní zepředu, ne ořezáním zezadu: „+42020777157655" je překlep mapéra
    // a devět číslic zezadu by z něj udělalo číslo, které v něm vůbec není.
    const local = digits.replace(/^(?:00)?420/, '');
    if (local.length !== 9) continue;
    // Czech numbers start 2-9; anything else is a date, a price or a postcode.
    if (!/^[2-9]/.test(local)) continue;
    return `+420 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return null;
}

export function extractContacts(html: string, siteUrl?: string): Pick<RawLead, 'email' | 'phone'> {
  const siteHost = registrableHost(siteUrl);
  const out: Pick<RawLead, 'email' | 'phone'> = {};

  // `mailto:` links are hand-written by the site owner, so they beat anything found in prose.
  const mailtos = Array.from(html.matchAll(/mailto:([^"'?>\s]+)/gi), m => m[1]);
  const candidates = [...mailtos, ...(html.match(EMAIL_RE) ?? [])];

  let best = 0;
  for (const raw of candidates) {
    const email = raw.trim().toLowerCase();
    const score = scoreEmail(email, siteHost) + (mailtos.includes(raw) ? 1 : 0);
    if (score > best) {
      best = score;
      out.email = email;
    }
  }

  const telHrefs = Array.from(html.matchAll(/tel:([+\d\s().-]+)/gi), m => m[1]);
  for (const raw of [...telHrefs, ...(html.match(TEL_RE) ?? [])]) {
    const phone = normalizeCzPhone(raw);
    if (phone) {
      out.phone = phone;
      break;
    }
  }

  return out;
}

/**
 * The link the site itself labels "Kontakt".
 *
 * Read out of HTML the probe already downloaded, so it costs no request. Used for the row's
 * button: on a firm that publishes nothing but a website, its contact page is the shortest path
 * from a result to an actual conversation — and it is the page where the address, the opening
 * hours and the person's name live.
 *
 * Only links back to the same host are accepted. A "kontakt" link pointing somewhere else is the
 * web designer's own page, or a booking platform, not the firm's contacts.
 */
export function contactPageUrl(html: string, siteUrl: string): string | undefined {
  let host: string;
  try {
    host = new URL(siteUrl).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return undefined;
  }

  const anchors = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,150}?)<\/a>/gi;
  let best: { score: number; url: string } | undefined;

  for (const m of Array.from(html.matchAll(anchors))) {
    const href = m[1];
    const label = m[2].replace(/<[^>]+>/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    // The visible label beats the path: plenty of sites route contacts through /page/17.
    const score = /\bkontakt/.test(label) || /\bcontact/.test(label) ? 3
      : /kontakt|contact/i.test(href) ? 2
      : 0;
    if (score === 0 || score <= (best?.score ?? 0)) continue;

    try {
      const url = new URL(href, siteUrl);
      if (!/^https?:$/.test(url.protocol)) continue;
      if (url.hostname.replace(/^www\./, '').toLowerCase() !== host) continue;
      // The fragment is kept on purpose: plenty of one-page sites keep their contacts in a
      // `#kontakt` section, and that anchor is exactly where the reader wants to land. Without
      // it the link would quietly resolve to the home page the button already offers.
      const resolved = url.toString();
      if (resolved.replace(/\/$/, '') === siteUrl.replace(/\/$/, '')) continue;
      best = { score, url: resolved };
    } catch {
      /* a malformed href is not a contact page */
    }
  }

  return best?.url;
}
