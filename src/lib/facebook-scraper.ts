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

// Names that are definitely Facebook UI, not real people
const SKIP_NAMES = new Set([
  'facebook', 'messenger', 'instagram', 'whatsapp', 'meta', 'oculus',
  'install', 'download', 'nainstalovat', 'stáhnout', 'log in', 'sign up',
  'přihlásit', 'registrovat', 'login', 'register', 'help', 'settings',
  'privacy', 'terms', 'about', 'back', 'next', 'more', 'see all',
  'load more', 'more results', 'show more', 'home', 'groups', 'pages',
  'events', 'search', 'notifications', 'friends', 'watch', 'gaming',
  'saved', 'marketplace', 'přátelé', 'skupiny', 'hledat', 'oznámení',
]);

// Valid profile slug: letters, numbers, dots, underscores, hyphens (no slashes after)
const VALID_SLUG = /^[a-zA-Z0-9._-]{3,60}$/;

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
  } catch {
    return null;
  }
}

function detectPageType(html: string): 'login' | 'install' | 'error' | 'ok' {
  if (html.includes('id="login_form"') || html.includes('/login/?next=')) return 'login';
  if (
    html.toLowerCase().includes('get the facebook app') ||
    html.toLowerCase().includes('nainstalujte aplikaci') ||
    (html.includes('install') && html.includes('app-store'))
  ) return 'install';
  if (html.length < 500) return 'error';
  return 'ok';
}

// Extract profile links ONLY from h3/strong context (post authors in mbasic)
function parsePostAuthors(html: string): Array<{ name: string; profilePath: string; postCount: number }> {
  const counts = new Map<string, { name: string; count: number }>();

  // mbasic post authors always appear inside <h3> or <strong> tags
  const patterns = [
    /<h3[^>]*>\s*<a\s+href="(\/(?:profile\.php\?[^"]*id=\d+[\w&=]*|[\w.]{3,60}))[^"]*"[^>]*>([^<]{3,60})<\/a>/gi,
    /<strong[^>]*>\s*<a\s+href="(\/(?:profile\.php\?[^"]*id=\d+[\w&=]*|[\w.]{3,60}))[^"]*"[^>]*>([^<]{3,60})<\/a>\s*<\/strong>/gi,
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      let rawPath = m[1];
      const rawName = m[2].trim();

      if (!rawName || rawName.length < 3 || rawName.length > 80) continue;

      // Skip UI/system names
      const nameLower = rawName.toLowerCase();
      if (SKIP_NAMES.has(nameLower)) continue;
      if (SKIP_NAMES.has(nameLower.split(' ')[0])) continue;
      if (nameLower.includes('facebook') || nameLower.includes('meta ')) continue;

      // Normalise path
      let profilePath: string;
      if (rawPath.includes('profile.php')) {
        const id = rawPath.match(/id=(\d+)/)?.[1];
        if (!id) continue;
        profilePath = `/profile.php?id=${id}`;
      } else {
        const slug = rawPath.replace(/^\//, '').split(/[/?#]/)[0];
        if (!VALID_SLUG.test(slug)) continue;
        // Skip obvious non-profile slugs
        if (SKIP_NAMES.has(slug.toLowerCase())) continue;
        profilePath = '/' + slug;
      }

      const existing = counts.get(profilePath);
      if (existing) {
        existing.count++;
      } else {
        counts.set(profilePath, { name: rawName, count: 1 });
      }
    }
  }

  return Array.from(counts.entries())
    .map(([path, { name, count }]) => ({ name, profilePath: path, postCount: count }))
    .sort((a, b) => b.postCount - a.postCount);
}

// Check member's About page for a website using the FB redirect wrapper
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

  const isPage = /kategorie|category|firemní stránka|business page|page info/i.test(html);

  // mbasic wraps external links: l.facebook.com/l.php?u=ENCODED_URL
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

function normalizeGroupUrl(input: string): string {
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
  const slug = normalizeGroupUrl(groupInput);
  if (!slug) return { leads: [], error: 'Zadej platný odkaz na skupinu.' };

  // Try fetching main group page (shows recent posts with authors)
  const groupUrl = `${MBASIC}/groups/${slug}`;
  const html = await fetchMbasic(groupUrl, cUser, xs);

  if (!html) {
    return { leads: [], error: 'Skupinu se nepodařilo načíst. Zkontroluj odkaz.' };
  }

  const pageType = detectPageType(html);
  if (pageType === 'login') {
    return { leads: [], error: 'Facebook cookies expiroval nebo jsou neplatné — obnov je v Profilu.' };
  }
  if (pageType === 'install') {
    return { leads: [], error: 'Facebook vrátil stránku pro instalaci aplikace. Zkus cookies znovu uložit.' };
  }
  if (pageType === 'error') {
    return { leads: [], error: 'Skupinu se nepodařilo načíst nebo neexistuje.' };
  }

  const authors = parsePostAuthors(html);

  if (authors.length === 0) {
    return {
      leads: [],
      error: 'Ve skupině nebyli nalezeni žádní přispěvatelé. Skupina může být soukromá nebo prázdná.',
    };
  }

  // Check up to 25 authors for website presence
  const top = authors.slice(0, 25);
  const leads: FbLead[] = [];

  for (let i = 0; i < top.length; i++) {
    const author = top[i];
    await sleep(500);
    const { hasWebsite, website, isPage } = await checkMemberWebsite(author.profilePath, cUser, xs);

    const score = Math.max(25, 95 - i * 3);
    const label = score >= 80 ? 'Velmi aktivní' : score >= 55 ? 'Aktivní' : 'Méně aktivní';

    leads.push({
      name: author.name,
      profileUrl: author.profilePath,
      facebookPageUrl: `https://www.facebook.com${author.profilePath}`,
      hasWebsite,
      website,
      isPage,
      postCount: author.postCount,
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
