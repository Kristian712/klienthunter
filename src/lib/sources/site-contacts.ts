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

function normalizeCzPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const nine = digits.length > 9 ? digits.slice(-9) : digits;
  if (nine.length !== 9) return null;
  // Czech numbers start 2-9; anything else is a date, a price or a postcode.
  if (!/^[2-9]/.test(nine)) return null;
  return `+420 ${nine.slice(0, 3)} ${nine.slice(3, 6)} ${nine.slice(6)}`;
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
