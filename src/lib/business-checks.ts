import axios from 'axios';
import { isRealWebsite, socialFromUrl } from './website-status';

export { isRealWebsite, socialFromUrl };

export interface BusinessChecks {
  hasWebsite: boolean;
  hasFacebook: boolean;
  hasInstagram: boolean;
  hasLinkedIn: boolean;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedInUrl?: string;
  email?: string;
  websiteIsOld: boolean;
  websiteScore: number;
  websiteAgeNote: string;
}

const HTTP_TIMEOUT = 5000;
const BOT_UA = 'Mozilla/5.0 (compatible; KlientHunterBot/1.0)';

// Extract full href URL for each social network from HTML
function extractSocialUrl(html: string, domain: string): string | undefined {
  // Match href="..." or href='...' containing the domain
  const pattern = new RegExp(
    `href=["']([^"']*(?:https?://)?(?:www\\.)?${domain}/[^"'\\s?#][^"']*)["']`,
    'i'
  );
  const m = html.match(pattern);
  if (!m) return undefined;
  let url = m[1];
  // Ensure absolute URL
  if (url.startsWith('//')) url = 'https:' + url;
  if (!url.startsWith('http')) url = 'https://' + url;
  // Filter out share/sharer links and plugin URLs
  if (/sharer|share\?|plugins|dialog\/feed/i.test(url)) return undefined;
  return url;
}

// Fetch HTML from a URL, return null if unreachable
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await axios.get(url, {
      timeout: HTTP_TIMEOUT,
      headers: {
        'User-Agent': BOT_UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'cs,en;q=0.9',
      },
      maxContentLength: 500_000,
      // Follow redirects (handles http→https, www→non-www etc.)
      maxRedirects: 5,
    });
    if (typeof res.data === 'string') return res.data;
    return null;
  } catch {
    return null;
  }
}

export async function analyzeBusinessFull(
  websiteUrl: string | undefined,
  prefetchedHtml?: string,
): Promise<BusinessChecks> {
  // ── If Google Places "website" is actually a social media URL, handle it ──
  if (websiteUrl && !isRealWebsite(websiteUrl)) {
    const social = socialFromUrl(websiteUrl);
    return {
      hasWebsite:   false,  // it's NOT a real website
      hasFacebook:  Boolean(social.fb),
      hasInstagram: Boolean(social.ig),
      hasLinkedIn:  Boolean(social.li),
      facebookUrl:  social.fb,
      instagramUrl: social.ig,
      linkedInUrl:  social.li,
      websiteIsOld: false,
      websiteScore: 0,
      websiteAgeNote: '',
    };
  }

  const hasWebsite = isRealWebsite(websiteUrl);

  if (!hasWebsite) {
    return {
      hasWebsite: false,
      hasFacebook: false,
      hasInstagram: false,
      hasLinkedIn: false,
      websiteIsOld: false,
      websiteScore: 0,
      websiteAgeNote: '',
    };
  }

  // Try to fetch the page for deeper analysis.
  // If fetch fails → website still EXISTS (hasWebsite stays true),
  // we just won't have social/quality data.
  const html = prefetchedHtml ?? (await fetchHtml(websiteUrl!));

  if (!html) {
    return {
      hasWebsite: true,
      hasFacebook: false,
      hasInstagram: false,
      hasLinkedIn: false,
      websiteIsOld: false,
      websiteScore: 50, // unknown
      websiteAgeNote: '',
    };
  }

  // ── Social media – extract actual profile URLs ──
  const facebookUrl  = extractSocialUrl(html, 'facebook\\.com');
  const instagramUrl = extractSocialUrl(html, 'instagram\\.com');
  const linkedInUrl  = extractSocialUrl(html, 'linkedin\\.com');
  const hasFacebook  = Boolean(facebookUrl);
  const hasInstagram = Boolean(instagramUrl);
  const hasLinkedIn  = Boolean(linkedInUrl);

  // ── Email extraction ──
  const emailMatch = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch?.[0]?.includes('example.') ? undefined : emailMatch?.[0];

  // ── Website quality / age scoring ──
  const quality = scoreWebsite(websiteUrl!, html);

  return {
    hasWebsite: true,
    hasFacebook,
    hasInstagram,
    hasLinkedIn,
    facebookUrl,
    instagramUrl,
    linkedInUrl,
    email,
    websiteIsOld:  quality.isOld,
    websiteScore:  quality.score,
    websiteAgeNote: quality.reasons.join(', '),
  };
}

function scoreWebsite(url: string, html: string): { isOld: boolean; score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 70;
  const currentYear = new Date().getFullYear();

  // ── Archaic HTML patterns — instant red flags ─────────────────────────
  if (/<font[\s>]/i.test(html)) {
    score -= 45; reasons.push('<font> tag (HTML 3.x era)');
  }
  if (/<marquee[\s>]/i.test(html)) {
    score -= 45; reasons.push('<marquee> tag');
  }
  if (/\s+bgcolor\s*=/i.test(html)) {
    score -= 35; reasons.push('bgcolor atribut (HTML 3.x)');
  }
  if (/<frameset[\s>]|<frame[\s>]/i.test(html)) {
    score -= 45; reasons.push('Rámce / frames');
  }

  // ── Flash ────────────────────────────────────────────────────────────
  if (/swfobject|\.swf[\s"'?]|flashplayer|macromedia/i.test(html)) {
    score -= 35; reasons.push('Flash');
  }

  // ── HTTPS ────────────────────────────────────────────────────────────
  if (!url.startsWith('https')) {
    score -= 25; reasons.push('Bez HTTPS');
  }

  // ── Mobile viewport ──────────────────────────────────────────────────
  if (!/<meta[^>]+viewport/i.test(html)) {
    score -= 30; reasons.push('Žádná mobilní verze');
  }

  // ── Copyright year ───────────────────────────────────────────────────
  const cpMatch = html.match(/(?:©|&copy;|copyright)[^<\n]{0,50}?(20\d{2}|19\d{2})/i);
  if (cpMatch) {
    const year = parseInt(cpMatch[1]);
    if (year <= currentYear - 5) { score -= 35; reasons.push(`Copyright ${year}`); }
    else if (year <= currentYear - 3) { score -= 20; reasons.push(`Copyright ${year}`); }
    else if (year <= currentYear - 1) { score -= 8;  reasons.push(`Copyright ${year}`); }
  }

  // ── Old DOCTYPE ──────────────────────────────────────────────────────
  if (/<!DOCTYPE\s+HTML\s+4|<!DOCTYPE\s+XHTML/i.test(html)) {
    score -= 20; reasons.push('Starý DOCTYPE (HTML 4/XHTML)');
  }

  // ── Table-heavy layout ───────────────────────────────────────────────
  const tables = (html.match(/<table/gi) ?? []).length;
  const divs   = (html.match(/<div/gi)   ?? []).length;
  if (tables > 10) { score -= 25; reasons.push(`Tabulkový layout (${tables} tabulek)`); }
  else if (tables > 4 && tables > divs / 2) { score -= 15; reasons.push(`Převážně tabulkový layout`); }

  // ── Old jQuery ───────────────────────────────────────────────────────
  const jq = html.match(/jquery[.\-v](\d+)\.(\d+)/i);
  if (jq) {
    const major = parseInt(jq[1]);
    if (major < 2) { score -= 15; reasons.push(`Starý jQuery ${jq[1]}.${jq[2]}`); }
  }

  // ── Old Bootstrap ────────────────────────────────────────────────────
  if (/bootstrap[.\-/]?[12]\./i.test(html) || /bootstrap[.\-/]3\.[0-4]/i.test(html)) {
    score -= 15; reasons.push('Bootstrap v1–v3');
  }

  // ── No external CSS at all ───────────────────────────────────────────
  if (!/<link[^>]+stylesheet/i.test(html)) {
    score -= 15; reasons.push('Žádný externí CSS');
  }

  // ── Inline bgcolor / style sprawl ────────────────────────────────────
  const inlineStyles = (html.match(/style\s*=\s*["'][^"']{30,}/gi) ?? []).length;
  if (inlineStyles > 20) {
    score -= 15; reasons.push(`Masivní inline styly (${inlineStyles}×)`);
  }

  // ── Very small page — likely placeholder or single-page brochure ─────
  if (html.length < 10_000) {
    score -= 15; reasons.push('Velmi malá stránka');
  }

  // ── Modern framework signals ─ strong positive ───────────────────────
  if (/react|__next_data__|vue\.js|angular\.min|nuxt|svelte/i.test(html)) {
    score += 20;
  }

  // ── Other positive indicators ─────────────────────────────────────────
  if (/<meta[^>]+og:/i.test(html))                          score += 8;  // Open Graph
  if (/gtag\(|googletagmanager|GTM-/i.test(html))           score += 5;  // GTM / GA4
  if (/cookie|gdpr|cookieconsent|cookiebot/i.test(html))     score += 5;  // cookie consent
  if (/application\/ld\+json|schema\.org/i.test(html))       score += 5;  // structured data

  score = Math.max(0, Math.min(100, score));

  // Threshold raised to 60 — sites must clearly look modern to pass
  return { isOld: score < 60, score, reasons };
}
