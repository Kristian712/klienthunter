import axios from 'axios';

export interface BusinessChecks {
  hasWebsite: boolean;
  hasFacebook: boolean;
  hasInstagram: boolean;
  hasLinkedIn: boolean;
  email?: string;
  websiteIsOld: boolean;
  websiteScore: number;    // 0 = very old, 100 = modern; 50 = unknown
  websiteAgeNote: string;
}

const HTTP_TIMEOUT = 8000;
const BOT_UA = 'Mozilla/5.0 (compatible; KlientHunterBot/1.0)';

const SOCIAL_PATTERNS = {
  facebook:  /(?:https?:\/\/)?(?:www\.)?facebook\.com\/[^"'\s>]+/i,
  instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[^"'\s>]+/i,
  linkedin:  /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^"'\s>]+/i,
};

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
  websiteUrl: string | undefined
): Promise<BusinessChecks> {
  // ── hasWebsite comes directly from Google Places data (the caller's websiteUrl) ──
  // We NEVER override this based on whether we can fetch the site.
  // Google Places is the ground truth for whether a business has a website.
  const hasWebsite = Boolean(websiteUrl);

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
  const html = await fetchHtml(websiteUrl!);

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

  // ── Social media detection ──
  const hasFacebook  = SOCIAL_PATTERNS.facebook.test(html);
  const hasInstagram = SOCIAL_PATTERNS.instagram.test(html);
  const hasLinkedIn  = SOCIAL_PATTERNS.linkedin.test(html);

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

  // HTTPS
  if (!url.startsWith('https')) {
    score -= 20;
    reasons.push('Nepoužívá HTTPS');
  }

  // Mobile viewport
  if (!/<meta[^>]+viewport/i.test(html)) {
    score -= 25;
    reasons.push('Není mobilní verze');
  }

  // Copyright year
  const cpMatch = html.match(/(?:©|&copy;|copyright)[^<\n]{0,40}?(20\d{2}|19\d{2})/i);
  if (cpMatch) {
    const year = parseInt(cpMatch[1]);
    if (year <= currentYear - 5) { score -= 25; reasons.push(`Copyright ${year}`); }
    else if (year <= currentYear - 3) { score -= 12; reasons.push(`Copyright ${year}`); }
  }

  // Flash
  if (/swfobject|\.swf[\s"'?]|flashplayer|macromedia/i.test(html)) {
    score -= 30;
    reasons.push('Používá Flash');
  }

  // Old DOCTYPE
  if (/<!DOCTYPE\s+HTML\s+4|<!DOCTYPE\s+XHTML/i.test(html)) {
    score -= 10;
    reasons.push('Starý DOCTYPE');
  }

  // Table-heavy layout
  const tables = (html.match(/<table/gi) ?? []).length;
  if (tables > 8) { score -= 15; reasons.push('Tabulkový layout'); }

  // Old jQuery
  const jq = html.match(/jquery[.\-v](\d+)\.(\d+)/i);
  if (jq && parseInt(jq[1]) < 2) {
    score -= 10;
    reasons.push(`jQuery ${jq[1]}.${jq[2]}`);
  }

  score = Math.max(0, Math.min(100, score));
  return { isOld: score < 45, score, reasons };
}
