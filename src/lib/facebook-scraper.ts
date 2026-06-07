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
  'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchMbasic(url: string): Promise<string | null> {
  try {
    const res = await axios.get(url, {
      timeout: 10_000,
      headers: {
        'User-Agent': MOBILE_UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'cs,sk;q=0.9,en;q=0.8',
      },
      maxContentLength: 1_000_000,
      maxRedirects: 5,
    });
    return typeof res.data === 'string' ? res.data : null;
  } catch {
    return null;
  }
}

function normalizeGroupUrl(input: string): string {
  let slug = input.trim();
  slug = slug.replace(/^https?:\/\/(www\.|m\.|mbasic\.)?facebook\.com\/groups\//i, '');
  slug = slug.replace(/^https?:\/\/fb\.com\/groups\//i, '');
  slug = slug.replace(/[/?#].*$/, '');
  return `${MBASIC}/groups/${slug}`;
}

function isLoginPage(html: string): boolean {
  return (
    html.includes('id="login_form"') ||
    (html.includes('name="email"') && html.includes('name="pass"')) ||
    html.includes('/login/?next=')
  );
}

// Extract unique post authors from mbasic group feed HTML using regex
function parseAuthors(html: string): Array<{ name: string; profilePath: string; postCount: number }> {
  const seen = new Map<string, { name: string; profilePath: string; postCount: number }>();

  // mbasic renders author names in <h3><a href="...">Name</a></h3> or <strong><a href="...">Name</a></strong>
  const patterns = [
    /<h3[^>]*><a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi,
    /<strong[^>]*><a\s+href="([^"]+)"[^>]*>([^<]+)<\/a><\/strong>/gi,
  ];

  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(html)) !== null) {
      let href = m[1];
      const name = m[2].trim();

      if (!name || !href) continue;

      // Decode HTML entities in href
      href = href.replace(/&amp;/g, '&');

      // Normalise: strip query params except for profile.php?id=
      if (href.includes('profile.php')) {
        const idMatch = href.match(/id=(\d+)/);
        if (idMatch) href = `/profile.php?id=${idMatch[1]}`;
        else continue;
      } else {
        // Keep only the path
        try {
          const u = href.startsWith('http') ? new URL(href) : new URL(href, 'https://mbasic.facebook.com');
          href = u.pathname;
        } catch {
          href = href.replace(/\?.*$/, '').replace(/#.*$/, '');
        }
      }

      // Skip group/search/page/hashtag paths and root
      if (!href || href === '/' || /\/(groups|search|hashtag|pages|events|marketplace)\//i.test(href)) continue;
      // Skip paths with only digits (group IDs)
      if (/^\/\d+$/.test(href)) continue;

      if (!seen.has(href)) {
        seen.set(href, { name, profilePath: href, postCount: 1 });
      } else {
        seen.get(href)!.postCount++;
      }
    }
  }

  return Array.from(seen.values());
}

// Fetch profile About page and extract website + page detection
async function fetchProfileData(
  profilePath: string
): Promise<{ hasWebsite: boolean; website?: string; isPage: boolean }> {
  const aboutUrl = `${MBASIC}${profilePath}/about`;
  const html = await fetchMbasic(aboutUrl);
  if (!html || isLoginPage(html)) {
    return { hasWebsite: false, isPage: false };
  }

  // Detect Facebook Pages by common page-only keywords
  const isPage =
    /kategorie|category|podnikání|business|page_info|fanpage/i.test(html) &&
    !html.includes('timeline_profile_cover');

  // mbasic wraps external links through l.facebook.com/l.php?u=ENCODED_URL
  let website: string | undefined;
  const externalLinkRe = /href="https?:\/\/(?:l|lm)\.facebook\.com\/l\.php\?u=([^"&]+)/gi;
  let em: RegExpExecArray | null;
  while ((em = externalLinkRe.exec(html)) !== null) {
    try {
      const decoded = decodeURIComponent(em[1]);
      if (!decoded.includes('facebook.com') && decoded.startsWith('http')) {
        website = decoded;
        break;
      }
    } catch { /* ignore */ }
  }

  return { hasWebsite: Boolean(website), website, isPage };
}

function activityScore(postCount: number): { score: number; label: string } {
  if (postCount >= 5) return { score: 95, label: 'Velmi aktivní' };
  if (postCount >= 3) return { score: 75, label: 'Aktivní' };
  if (postCount >= 2) return { score: 55, label: 'Středně aktivní' };
  return { score: 30, label: 'Méně aktivní' };
}

export async function scrapeFacebookGroup(
  groupInput: string
): Promise<{ leads: FbLead[]; error?: string }> {
  const groupUrl = normalizeGroupUrl(groupInput);
  const html = await fetchMbasic(groupUrl);

  if (!html) {
    return { leads: [], error: 'Skupinu se nepodařilo načíst. Zkontroluj název nebo odkaz.' };
  }

  if (isLoginPage(html)) {
    return {
      leads: [],
      error: 'Tato skupina je soukromá – přístup bez přihlášení není možný. Zkus veřejnou skupinu.',
    };
  }

  const authors = parseAuthors(html);

  if (authors.length === 0) {
    return {
      leads: [],
      error: 'Ve skupině nebyli nalezeni žádní přispěvatelé. Skupina může být soukromá nebo prázdná.',
    };
  }

  // Check up to 30 most active authors
  const top = authors.sort((a, b) => b.postCount - a.postCount).slice(0, 30);

  const leads: FbLead[] = [];

  for (const author of top) {
    await sleep(400);
    const profile = await fetchProfileData(author.profilePath);
    const { score, label } = activityScore(author.postCount);

    leads.push({
      name: author.name,
      profileUrl: author.profilePath,
      facebookPageUrl: `https://www.facebook.com${author.profilePath}`,
      hasWebsite: profile.hasWebsite,
      website: profile.website,
      isPage: profile.isPage,
      postCount: author.postCount,
      activityScore: score,
      activityLabel: label,
    });
  }

  const filtered = leads
    .filter(l => !l.hasWebsite)
    .sort((a, b) => b.activityScore - a.activityScore);

  return { leads: filtered };
}
