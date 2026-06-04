import axios from 'axios';

export interface BusinessChecks {
  hasWebsite: boolean;
  hasFacebook: boolean;
  hasInstagram: boolean;
  hasLinkedIn: boolean;
  email?: string;
  websiteIsOld: boolean;
  websiteScore: number;   // 0 = very old/bad, 100 = modern
  websiteAgeNote: string; // comma-separated reasons
}

export interface WebsiteQuality {
  isOld: boolean;
  score: number;
  reasons: string[];
}

const SOCIAL_PATTERNS = {
  facebook:  /facebook\.com|fb\.com/i,
  instagram: /instagram\.com/i,
  linkedin:  /linkedin\.com/i,
};

const HTTP_TIMEOUT = 8000;
const BOT_UA = 'Mozilla/5.0 (compatible; KlientHunterBot/1.0)';

export async function checkWebsite(url: string | undefined): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await axios.head(url, { timeout: 5000 });
    return res.status < 400;
  } catch {
    try {
      // HEAD might be blocked – fall back to GET
      const res = await axios.get(url, { timeout: 5000, maxContentLength: 1024 });
      return res.status < 400;
    } catch {
      return false;
    }
  }
}

export async function analyzeWebsiteQuality(url: string): Promise<WebsiteQuality> {
  const reasons: string[] = [];
  let score = 70; // neutral start

  try {
    const res = await axios.get(url, {
      timeout: HTTP_TIMEOUT,
      headers: { 'User-Agent': BOT_UA },
      maxContentLength: 500_000,
    });

    const html: string = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const currentYear = new Date().getFullYear();

    // ── HTTPS ──
    if (!url.startsWith('https')) {
      score -= 20;
      reasons.push('Nepoužívá HTTPS');
    }

    // ── Mobile viewport ──
    if (!/<meta[^>]+viewport/i.test(html)) {
      score -= 25;
      reasons.push('Není mobilní verze');
    }

    // ── Copyright year ──
    const cpMatch = html.match(/(?:©|&copy;|copyright)[^<\n]{0,40}?(20\d{2}|19\d{2})/i);
    if (cpMatch) {
      const cpYear = parseInt(cpMatch[1]);
      if (cpYear <= currentYear - 5) {
        score -= 25;
        reasons.push(`Copyright ${cpYear}`);
      } else if (cpYear <= currentYear - 3) {
        score -= 12;
        reasons.push(`Copyright ${cpYear}`);
      }
    }

    // ── Last-Modified header ──
    const lm = res.headers['last-modified'];
    if (lm) {
      const lmYear = new Date(lm).getFullYear();
      if (lmYear <= currentYear - 4) {
        score -= 15;
        reasons.push(`Naposledy změněno ${lmYear}`);
      }
    }

    // ── Flash ──
    if (/swfobject|\.swf[\s"'?]|flashplayer|macromedia/i.test(html)) {
      score -= 30;
      reasons.push('Používá Flash');
    }

    // ── Old DOCTYPE ──
    if (/<!DOCTYPE\s+HTML\s+4|<!DOCTYPE\s+XHTML/i.test(html)) {
      score -= 10;
      reasons.push('Starý DOCTYPE');
    }

    // ── Table-based layout (lots of nested tables = old design) ──
    const tableCount = (html.match(/<table/gi) ?? []).length;
    if (tableCount > 8) {
      score -= 15;
      reasons.push('Tabulkový layout');
    }

    // ── Old jQuery ──
    const jqMatch = html.match(/jquery[.\-v](\d+)\.(\d+)/i);
    if (jqMatch && parseInt(jqMatch[1]) < 2) {
      score -= 10;
      reasons.push(`jQuery ${jqMatch[1]}.${jqMatch[2]}`);
    }

    // ── No CSS framework / very small page → likely hand-coded old site ──
    if (!/bootstrap|tailwind|bulma|foundation|materialize/i.test(html) && html.length < 15_000) {
      score -= 8;
      reasons.push('Bez CSS frameworku');
    }

    // ── Favicon present (small positive signal) ──
    if (/<link[^>]+rel=["']?(?:shortcut )?icon/i.test(html)) score += 3;

    // ── Clamp ──
    score = Math.max(0, Math.min(100, score));

    return { isOld: score < 45, score, reasons };
  } catch {
    // Can't fetch → treat as unknown (not penalised)
    return { isOld: false, score: 50, reasons: [] };
  }
}

export async function checkSocialMedia(url: string | undefined) {
  if (!url) return { hasFacebook: false, hasInstagram: false, hasLinkedIn: false };
  try {
    const res = await axios.get(url, {
      timeout: HTTP_TIMEOUT,
      headers: { 'User-Agent': BOT_UA },
      maxContentLength: 300_000,
    });
    const html: string = res.data;
    return {
      hasFacebook:  SOCIAL_PATTERNS.facebook.test(html),
      hasInstagram: SOCIAL_PATTERNS.instagram.test(html),
      hasLinkedIn:  SOCIAL_PATTERNS.linkedin.test(html),
    };
  } catch {
    return { hasFacebook: false, hasInstagram: false, hasLinkedIn: false };
  }
}

export async function extractEmail(url: string | undefined): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const res = await axios.get(url, {
      timeout: HTTP_TIMEOUT,
      headers: { 'User-Agent': BOT_UA },
      maxContentLength: 300_000,
    });
    const html: string = res.data;
    const m = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    // Skip common false positives
    if (m && !m[0].includes('example.') && !m[0].includes('@sentry')) return m[0];
    return undefined;
  } catch {
    return undefined;
  }
}

export async function analyzeBusinessFull(websiteUrl: string | undefined): Promise<BusinessChecks> {
  const hasWebsite = await checkWebsite(websiteUrl);

  if (!hasWebsite) {
    return {
      hasWebsite: false,
      hasFacebook: false, hasInstagram: false, hasLinkedIn: false,
      websiteIsOld: false, websiteScore: 0, websiteAgeNote: '',
    };
  }

  const [social, email, quality] = await Promise.all([
    checkSocialMedia(websiteUrl),
    extractEmail(websiteUrl),
    analyzeWebsiteQuality(websiteUrl!),
  ]);

  return {
    hasWebsite: true,
    ...social,
    email,
    websiteIsOld:  quality.isOld,
    websiteScore:  quality.score,
    websiteAgeNote: quality.reasons.join(', '),
  };
}
