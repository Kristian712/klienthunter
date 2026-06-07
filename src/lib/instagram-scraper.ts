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

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1';

const LINK_IN_BIO = ['linktr.ee', 'linktree', 'links.ee', 'beacons.ai', 'bio.link', 'taplink.cc', 'solo.to', 'campsite.bio'];

const IG_SKIP = new Set(['p', 'reel', 'explore', 'stories', 'accounts', 'direct', 'tv', 'reels', 'about', 'blog', 'press', 'legal', 'help', 'privacy', 'safety', 'api', 'developer', 'download', 'lite', 'ads', 'hashtag', 'music']);

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

function extractUsername(url: string): string | null {
  try {
    const path = new URL(url).pathname.replace(/^\//, '').replace(/\/$/, '');
    const segment = path.split('/')[0];
    if (!segment || segment.length < 2 || IG_SKIP.has(segment)) return null;
    if (!/^[a-zA-Z0-9._]{2,30}$/.test(segment)) return null;
    return segment.toLowerCase();
  } catch { return null; }
}

async function cseSearch(query: string): Promise<string[]> {
  const key = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) return [];

  try {
    const res = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: { key, cx, q: query, num: 10, gl: 'cz', hl: 'cs' },
      timeout: 12_000,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = res.data?.items ?? [];
    const usernames: string[] = [];
    for (const item of items) {
      const u = extractUsername(item.link ?? '');
      if (u) usernames.push(u);
    }
    return usernames;
  } catch { return []; }
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
    if (!user?.username) return null;

    const website = user.external_url || undefined;
    const hasWebsite = isRealWebsite(website);
    const followers = user.edge_followed_by?.count ?? 0;

    return {
      username: user.username,
      fullName: user.full_name || user.username,
      biography: (user.biography || '').substring(0, 150),
      followers,
      profileUrl: `https://www.instagram.com/${user.username}/`,
      hasWebsite,
      website: hasWebsite ? website : undefined,
      activityLabel: activityLabel(followers),
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

  if (!process.env.GOOGLE_CSE_API_KEY || !process.env.GOOGLE_CSE_ID) {
    return { leads: [], total: 0, error: 'Instagram vyhledávání není nakonfigurováno.' };
  }

  const queries = [
    `${nic}${loc ? ' ' + loc : ''}`,
    ...(loc ? [`${loc} ${nic}`] : []),
  ];

  const results = await Promise.all(queries.map(q => cseSearch(q)));

  const seen = new Set<string>();
  const usernames: string[] = [];
  for (const batch of results) {
    for (const u of batch) {
      if (!seen.has(u)) { seen.add(u); usernames.push(u); }
    }
  }

  if (usernames.length === 0) {
    return { leads: [], total: 0, error: 'Žádné Instagram profily nenalezeny. Zkus jiný obor nebo město.' };
  }

  const profiles: IgLead[] = [];
  for (const username of usernames.slice(0, 20)) {
    await sleep(200);
    const p = await fetchIgProfile(username);
    if (p) profiles.push(p);
  }

  if (profiles.length === 0) {
    return { leads: [], total: 0, error: 'Nepodařilo se načíst profily z Instagramu.' };
  }

  const noWebsite = profiles
    .filter(p => !p.hasWebsite)
    .sort((a, b) => b.followers - a.followers);

  return { leads: noWebsite, total: profiles.length };
}
