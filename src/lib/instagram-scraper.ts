import axios from 'axios';

export interface IgLead {
  username: string;
  fullName: string;
  biography: string;
  followers: number;
  profileUrl: string;
  hasWebsite: boolean;
  website?: string;
  activityLabel: string;
}

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const MOBILE_UA  = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1';

const LINK_IN_BIO = ['linktr.ee', 'linktree', 'links.ee', 'beacons.ai', 'bio.link', 'taplink.cc', 'solo.to', 'campsite.bio'];

function activityLabel(followers: number): string {
  if (followers >= 5000) return 'Velmi aktivní';
  if (followers >= 500)  return 'Aktivní';
  return 'Začínající';
}

function isRealWebsite(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (LINK_IN_BIO.some(d => host.includes(d))) return false;
    if (host.includes('instagram.com') || host.includes('facebook.com')) return false;
    return true;
  } catch { return false; }
}

const IG_SKIP = new Set(['p', 'reel', 'explore', 'stories', 'accounts', 'direct', 'tv', 'reels', 'about', 'blog', 'press', 'legal', 'help', 'privacy', 'safety', 'api', 'developer', 'download', 'lite', 'ads']);

function extractUsernames(html: string): string[] {
  const seen = new Set<string>();
  // Match instagram.com/USERNAME from hrefs and text
  const re = /instagram\.com\/([a-zA-Z0-9._]{2,30})\/?[^a-zA-Z0-9._]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const u = m[1].toLowerCase();
    if (!IG_SKIP.has(u) && !u.startsWith('_') && !u.endsWith('_')) seen.add(u);
  }
  return Array.from(seen);
}

async function ddgSearch(query: string): Promise<string | null> {
  try {
    const res = await axios.post(
      'https://html.duckduckgo.com/html/',
      new URLSearchParams({ q: query, kl: 'cs-cz' }).toString(),
      { headers: { 'User-Agent': BROWSER_UA, 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 12_000 }
    );
    return typeof res.data === 'string' ? res.data : null;
  } catch { return null; }
}

async function fetchIgProfile(username: string): Promise<IgLead | null> {
  try {
    const res = await axios.get(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
      {
        headers: { 'User-Agent': MOBILE_UA, 'X-IG-App-ID': '936619743392459', Accept: 'application/json' },
        timeout: 8_000,
      }
    );
    const user = res.data?.data?.user;
    if (!user || !user.username) return null;

    const website = user.external_url || undefined;
    const hasWebsite = isRealWebsite(website);

    return {
      username: user.username,
      fullName: user.full_name || user.username,
      biography: (user.biography || '').substring(0, 150),
      followers: user.edge_followed_by?.count ?? 0,
      profileUrl: `https://www.instagram.com/${user.username}/`,
      hasWebsite,
      website: hasWebsite ? website : undefined,
      activityLabel: activityLabel(user.edge_followed_by?.count ?? 0),
    };
  } catch { return null; }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export async function searchInstagram(
  niche: string,
  location: string
): Promise<{ leads: IgLead[]; total: number; error?: string }> {
  const loc = location.trim();
  const nic = niche.trim();

  // Run 3 query variants in parallel for max coverage
  const queries = [
    `site:instagram.com ${nic}${loc ? ' ' + loc : ''}`,
    `${nic}${loc ? ' ' + loc : ''} instagram`,
    `${nic} instagram profil${loc ? ' ' + loc : ''}`,
  ];

  const htmls = await Promise.all(queries.map(q => ddgSearch(q)));

  const seen = new Set<string>();
  const usernames: string[] = [];
  for (const html of htmls) {
    if (!html) continue;
    for (const u of extractUsernames(html)) {
      if (!seen.has(u)) { seen.add(u); usernames.push(u); }
    }
  }

  if (usernames.length === 0) {
    return { leads: [], total: 0, error: 'Žádné Instagram profily nenalezeny. Zkus jiný obor nebo město.' };
  }

  const profiles: IgLead[] = [];
  for (const username of usernames.slice(0, 20)) {
    await sleep(250);
    const p = await fetchIgProfile(username);
    if (p) profiles.push(p);
  }

  if (profiles.length === 0) {
    return { leads: [], total: 0, error: 'Nepodařilo se načíst profily. Zkus jiný obor.' };
  }

  const noWebsite = profiles
    .filter(p => !p.hasWebsite)
    .sort((a, b) => b.followers - a.followers);

  return { leads: noWebsite, total: profiles.length };
}
