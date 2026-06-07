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

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function buildCookieHeader(cUser: string, xs: string): string {
  return `c_user=${cUser}; xs=${xs}; locale=cs_CZ`;
}

async function fetchMbasic(url: string, cookieHeader: string): Promise<string | null> {
  try {
    const res = await axios.get(url, {
      timeout: 12_000,
      headers: {
        'User-Agent': MOBILE_UA,
        Cookie: cookieHeader,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'cs,sk;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        Referer: 'https://mbasic.facebook.com/',
      },
      maxContentLength: 2_000_000,
      maxRedirects: 5,
    });
    return typeof res.data === 'string' ? res.data : null;
  } catch {
    return null;
  }
}

function isLoginPage(html: string): boolean {
  return (
    html.includes('id="login_form"') ||
    (html.includes('name="email"') && html.includes('name="pass"')) ||
    html.includes('/login/?next=') ||
    html.includes('You must log in to continue')
  );
}

function normalizeGroupUrl(input: string): { slug: string; url: string } {
  let s = input.trim();
  s = s.replace(/^https?:\/\/(www\.|m\.|mbasic\.)?facebook\.com\/groups\//i, '');
  s = s.replace(/^https?:\/\/fb\.com\/groups\//i, '');
  s = s.replace(/[/?#].*$/, '');
  return { slug: s, url: `${MBASIC}/groups/${s}` };
}

// Parse member names + profile paths from group members page
function parseMembers(html: string): Array<{ name: string; profilePath: string }> {
  const members: Array<{ name: string; profilePath: string }> = [];
  const seen = new Set<string>();

  // mbasic members page: links inside <td> cells with profile hrefs
  // Pattern: <a href="/SLUG" or /profile.php?id=NNN
  const re = /<a\s+href="(\/(?:profile\.php\?id=\d+|[^"/?\s][^"?#]*))[^"]*"\s*>([^<]{2,60})<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    let path = m[1];
    const name = m[2].trim();

    if (!name || name.length < 2) continue;

    // Normalize profile.php
    if (path.includes('profile.php')) {
      const id = path.match(/id=(\d+)/)?.[1];
      if (!id) continue;
      path = `/profile.php?id=${id}`;
    } else {
      // Keep only first segment
      path = '/' + path.replace(/^\//, '').split('/')[0];
    }

    // Skip FB system paths
    const skip = /^\/(groups|search|hashtag|pages|events|marketplace|login|home|watch|gaming|business|friends|notifications|messages|help|settings|bookmarks|gaming|reels)$/i;
    if (skip.test(path) || path === '/') continue;

    if (seen.has(path)) continue;
    seen.add(path);

    members.push({ name, profilePath: path });
  }

  return members;
}

// Check member's About page for a website
async function checkMemberWebsite(
  profilePath: string,
  cookieHeader: string
): Promise<{ hasWebsite: boolean; website?: string; isPage: boolean }> {
  const aboutUrl = `${MBASIC}${profilePath.includes('profile.php') ? profilePath + '&v=info' : profilePath + '/about'}`;
  const html = await fetchMbasic(aboutUrl, cookieHeader);

  if (!html || isLoginPage(html)) return { hasWebsite: false, isPage: false };

  // Detect business page
  const isPage = /kategorie|category|podnikání|business|page_info|firemní|company/i.test(html);

  // mbasic wraps external links via l.facebook.com/l.php?u=ENCODED
  const linkRe = /href="https?:\/\/(?:l|lm)\.facebook\.com\/l\.php\?u=([^"&]+)/gi;
  let lm: RegExpExecArray | null;
  while ((lm = linkRe.exec(html)) !== null) {
    try {
      const decoded = decodeURIComponent(lm[1]);
      if (!decoded.includes('facebook.com') && decoded.startsWith('http')) {
        return { hasWebsite: true, website: decoded, isPage };
      }
    } catch { /* skip */ }
  }

  return { hasWebsite: false, isPage };
}

export async function scrapeFacebookGroup(
  groupInput: string,
  cUser: string,
  xs: string
): Promise<{ leads: FbLead[]; error?: string }> {
  const { slug, url: groupUrl } = normalizeGroupUrl(groupInput);
  const cookieHeader = buildCookieHeader(cUser, xs);

  // Fetch group members page
  const membersUrl = `${MBASIC}/groups/${slug}/members`;
  const html = await fetchMbasic(membersUrl, cookieHeader);

  if (!html) {
    return { leads: [], error: 'Skupinu se nepodařilo načíst. Zkontroluj odkaz.' };
  }

  if (isLoginPage(html)) {
    return {
      leads: [],
      error: 'Facebook cookies expiroval nebo jsou neplatné. Obnov je v Profilu.',
    };
  }

  const members = parseMembers(html);

  if (members.length === 0) {
    // Try the main group page instead (some groups show members there)
    const groupHtml = await fetchMbasic(groupUrl, cookieHeader);
    if (groupHtml && !isLoginPage(groupHtml)) {
      const fallbackMembers = parseMembers(groupHtml);
      if (fallbackMembers.length === 0) {
        return {
          leads: [],
          error: 'Ve skupině nebyli nalezeni žádní členové. Možná nemáš přístup, nebo je skupina prázdná.',
        };
      }
      members.push(...fallbackMembers);
    } else {
      return {
        leads: [],
        error: 'Nepodařilo se načíst členy skupiny. Zkontroluj, zda máš přístup do této skupiny.',
      };
    }
  }

  // Check up to 30 members for website
  const top = members.slice(0, 30);
  const leads: FbLead[] = [];

  for (let i = 0; i < top.length; i++) {
    const member = top[i];
    await sleep(400);
    const { hasWebsite, website, isPage } = await checkMemberWebsite(member.profilePath, cookieHeader);

    const score = Math.max(25, 95 - i * 3);
    const label = score >= 80 ? 'Velmi aktivní' : score >= 55 ? 'Aktivní' : 'Méně aktivní';

    leads.push({
      name: member.name,
      profileUrl: member.profilePath,
      facebookPageUrl: `https://www.facebook.com${member.profilePath}`,
      hasWebsite,
      website,
      isPage,
      postCount: 1,
      activityScore: score,
      activityLabel: label,
    });
  }

  const noWebsite = leads.filter(l => !l.hasWebsite);
  return { leads: noWebsite };
}
