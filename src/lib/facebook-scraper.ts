import axios from 'axios';

export interface FbLead {
  name: string;
  profileUrl: string;
  facebookPageUrl: string;
  hasWebsite: boolean;
  website?: string;
  isPage: boolean;
  postCount: number;
  activityScore: number;
  activityLabel: string;
}

const MBASIC = 'https://mbasic.facebook.com';
const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36';

const SKIP_NAMES = new Set([
  'facebook', 'messenger', 'instagram', 'whatsapp', 'meta', 'oculus',
  'install', 'download', 'nainstalovat', 'stáhnout', 'log in', 'sign up',
  'přihlásit', 'registrovat', 'login', 'register', 'help', 'settings',
  'privacy', 'terms', 'about', 'back', 'next', 'more', 'see all',
  'load more', 'more results', 'show more', 'home', 'groups', 'pages',
  'events', 'search', 'notifications', 'friends', 'watch', 'gaming',
  'saved', 'marketplace', 'přátelé', 'skupiny', 'hledat', 'oznámení',
  'zprávy', 'profil', 'profile', 'timeline', 'wall',
]);

// System path slugs that are not real profiles
const SKIP_SLUGS = new Set([
  'groups', 'pages', 'events', 'marketplace', 'gaming', 'watch',
  'login', 'logout', 'register', 'help', 'settings', 'privacy',
  'terms', 'about', 'home', 'search', 'friends', 'notifications',
  'messages', 'saved', 'reels', 'stories', 'live', 'fundraisers',
  'offers', 'weather', 'memories', 'ads', 'business', 'campus',
  'news', 'voting', 'jobs', 'dating', 'gaming', 'bookmarks',
  'dialog', 'sharer', 'share', 'plugins', 'video', 'photo',
  'hashtag', 'explore', 'trending', 'reel', 'story',
]);

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchMbasic(url: string, cUser: string, xs: string): Promise<string | null> {
  try {
    const res = await axios.get(url, {
      timeout: 15_000,
      headers: {
        'User-Agent': MOBILE_UA,
        Cookie: `c_user=${cUser}; xs=${xs}; locale=cs_CZ; datr=ok`,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'cs,sk;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        Referer: MBASIC + '/',
        'Upgrade-Insecure-Requests': '1',
      },
      maxContentLength: 3_000_000,
      maxRedirects: 5,
    });
    return typeof res.data === 'string' ? res.data : null;
  } catch (e: unknown) {
    const err = e as { response?: { status?: number } };
    console.error('[FB scraper] fetchMbasic failed:', url, err?.response?.status);
    return null;
  }
}

function detectPageType(html: string): 'login' | 'install' | 'error' | 'ok' {
  if (html.includes('id="login_form"') || html.includes('/login/?next=')) return 'login';
  if (
    html.toLowerCase().includes('get the facebook app') ||
    html.toLowerCase().includes('nainstalujte aplikaci') ||
    (html.includes('app-store') && html.length < 5000)
  ) return 'install';
  if (html.length < 500) return 'error';
  return 'ok';
}

function isValidName(name: string): boolean {
  if (!name || name.length < 3 || name.length > 80) return false;
  const lower = name.toLowerCase().trim();
  if (SKIP_NAMES.has(lower)) return false;
  if (SKIP_NAMES.has(lower.split(' ')[0])) return false;
  if (lower.includes('facebook') || lower.includes('instagram') || lower.includes('meta ')) return false;
  // Must contain at least one letter
  if (!/[a-zA-ZáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(name)) return false;
  return true;
}

function isValidSlug(slug: string): boolean {
  if (!slug || slug.length < 2) return false;
  if (SKIP_SLUGS.has(slug.toLowerCase())) return false;
  // Must be alphanumeric + dots/underscores/hyphens only
  if (!/^[a-zA-Z0-9._-]{2,80}$/.test(slug)) return false;
  return true;
}

// Normalise any FB href (relative or absolute) to a canonical profilePath
function hrefToProfilePath(href: string): string | null {
  // Strip absolute mbasic/m/www prefix
  href = href
    .replace(/^https?:\/\/(mbasic\.|m\.|www\.)?facebook\.com/, '')
    .replace(/&amp;/g, '&');

  if (!href.startsWith('/')) return null;

  // profile.php — extract numeric id
  if (href.includes('profile.php')) {
    const id = href.match(/id=(\d+)/)?.[1];
    return id ? `/profile.php?id=${id}` : null;
  }

  // /NNN  or  /slug  (first path segment only)
  const slug = href.replace(/^\//, '').split(/[/?#]/)[0];
  if (!isValidSlug(slug)) return null;
  return '/' + slug;
}

// Extract profile links from HTML — tries multiple strategies
function parseProfiles(html: string): Array<{ name: string; profilePath: string; postCount: number }> {
  const counts = new Map<string, { name: string; count: number }>();

  const addProfile = (rawHref: string, rawName: string) => {
    const name = rawName.replace(/&amp;/g, '&').replace(/&#039;/g, "'").trim();
    if (!isValidName(name)) return;

    const profilePath = hrefToProfilePath(rawHref);
    if (!profilePath) return;

    const existing = counts.get(profilePath);
    if (existing) {
      existing.count++;
      if (name.length > existing.name.length) existing.name = name;
    } else {
      counts.set(profilePath, { name, count: 1 });
    }
  };

  let m: RegExpExecArray | null;

  // Strategy 1: links inside <h3> (post author headers in mbasic)
  const h3Re = /<h3[^>]*>[\s\S]{0,100}<a\s+href="([^"]+)"[^>]*>([^<]{2,80})<\/a>/gi;
  while ((m = h3Re.exec(html)) !== null) addProfile(m[1], m[2]);

  // Strategy 2: links inside <strong> (alt mbasic author pattern)
  const strongRe = /<strong[^>]*>[\s\S]{0,50}<a\s+href="([^"]+)"[^>]*>([^<]{2,80})<\/a>/gi;
  while ((m = strongRe.exec(html)) !== null) addProfile(m[1], m[2]);

  // Strategy 3: any profile.php link (always a real profile, regardless of context)
  const phpRe = /<a\s+href="([^"]*profile\.php[^"]*)"[^>]*>([^<]{2,80})<\/a>/gi;
  while ((m = phpRe.exec(html)) !== null) addProfile(m[1], m[2]);

  // Strategy 4: data-ft blocks (mbasic story containers)
  const ftRe = /data-ft="[^"]*"[^>]*>[\s\S]{0,200}?<a\s+href="([^"]+)"[^>]*>([^<]{2,80})<\/a>/gi;
  while ((m = ftRe.exec(html)) !== null) addProfile(m[1], m[2]);

  // Strategy 5: broad fallback — all anchors with valid-looking FB hrefs
  if (counts.size === 0) {
    const broadRe = /<a\s+href="([^"]{5,120})"[^>]*>([^<]{3,60})<\/a>/gi;
    while ((m = broadRe.exec(html)) !== null) {
      if (m[1].includes('facebook.com') || m[1].startsWith('/')) {
        addProfile(m[1], m[2]);
      }
    }
  }

  console.log(`[FB scraper] strategies done: ${counts.size} profiles | html len: ${html.length}`);

  return Array.from(counts.entries())
    .map(([path, { name, count }]) => ({ name, profilePath: path, postCount: count }))
    .sort((a, b) => b.postCount - a.postCount);
}

async function checkMemberWebsite(
  profilePath: string,
  cUser: string,
  xs: string,
): Promise<{ hasWebsite: boolean; website?: string; isPage: boolean }> {
  const isPhpProfile = profilePath.includes('profile.php');
  const aboutUrl = isPhpProfile
    ? `${MBASIC}${profilePath}&v=info`
    : `${MBASIC}${profilePath}/about`;

  const html = await fetchMbasic(aboutUrl, cUser, xs);
  if (!html || detectPageType(html) !== 'ok') return { hasWebsite: false, isPage: false };

  const isPage = /kategorie|category|firemní stránka|business page/i.test(html);

  const externalRe = /href="https?:\/\/(?:l|lm)\.facebook\.com\/l\.php\?u=([^"&]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = externalRe.exec(html)) !== null) {
    try {
      const decoded = decodeURIComponent(m[1]);
      if (
        decoded.startsWith('http') &&
        !decoded.includes('facebook.com') &&
        !decoded.includes('instagram.com') &&
        !decoded.includes('linkedin.com') &&
        !decoded.includes('whatsapp.com')
      ) {
        return { hasWebsite: true, website: decoded, isPage };
      }
    } catch { /* skip */ }
  }

  return { hasWebsite: false, isPage };
}

function normalizeGroupSlug(input: string): string {
  let s = input.trim();
  s = s.replace(/^https?:\/\/(www\.|m\.|mbasic\.)?facebook\.com\/groups\//i, '');
  s = s.replace(/^https?:\/\/fb\.com\/groups\//i, '');
  s = s.replace(/[/?#].*$/, '');
  return s;
}

export async function scrapeFacebookGroup(
  groupInput: string,
  cUser: string,
  xs: string,
): Promise<{ leads: FbLead[]; error?: string }> {
  const slug = normalizeGroupSlug(groupInput);
  if (!slug) return { leads: [], error: 'Zadej platný odkaz na skupinu.' };

  const groupUrl = `${MBASIC}/groups/${slug}`;
  console.log('[FB scraper] Fetching group:', groupUrl);

  const html = await fetchMbasic(groupUrl, cUser, xs);

  if (!html) {
    return { leads: [], error: 'Skupinu se nepodařilo načíst. Zkontroluj odkaz.' };
  }

  console.log('[FB scraper] Page type:', detectPageType(html), '| length:', html.length);
  // Log first 300 chars to help debug structure
  console.log('[FB scraper] HTML start:', html.substring(0, 300).replace(/\n/g, ' '));

  const pageType = detectPageType(html);
  if (pageType === 'login') {
    return { leads: [], error: 'Facebook cookies expiroval — obnov je v Profilu.' };
  }
  if (pageType === 'install') {
    return { leads: [], error: 'Facebook vrátil stránku pro instalaci aplikace. Zkus cookies znovu uložit.' };
  }
  if (pageType === 'error') {
    return { leads: [], error: 'Skupinu se nepodařilo načíst nebo neexistuje.' };
  }

  const profiles = parseProfiles(html);

  if (profiles.length === 0) {
    return {
      leads: [],
      error: 'Ve skupině nebyli nalezeni žádní přispěvatelé. Zkontroluj, že jsi členem skupiny a skupina má nedávné příspěvky.',
    };
  }

  const top = profiles.slice(0, 25);
  const leads: FbLead[] = [];

  for (let i = 0; i < top.length; i++) {
    const p = top[i];
    await sleep(500);
    const { hasWebsite, website, isPage } = await checkMemberWebsite(p.profilePath, cUser, xs);

    const score = Math.max(25, 95 - i * 3);
    const label = score >= 80 ? 'Velmi aktivní' : score >= 55 ? 'Aktivní' : 'Méně aktivní';

    leads.push({
      name: p.name,
      profileUrl: p.profilePath,
      facebookPageUrl: `https://www.facebook.com${p.profilePath}`,
      hasWebsite,
      website,
      isPage,
      postCount: p.postCount,
      activityScore: score,
      activityLabel: label,
    });
  }

  const noWebsite = leads.filter(l => !l.hasWebsite);
  if (noWebsite.length === 0 && leads.length > 0) {
    return { leads: [], error: 'Všichni nalezení přispěvatelé pravděpodobně web mají.' };
  }

  return { leads: noWebsite };
}
