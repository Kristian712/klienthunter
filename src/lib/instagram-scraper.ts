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
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1';

const LINK_IN_BIO_DOMAINS = ['linktr.ee', 'linktree', 'links.ee', 'beacons.ai', 'bio.link', 'taplink.cc', 'solo.to'];

function activityLabel(followers: number): string {
  if (followers >= 5000) return 'Velmi aktivní';
  if (followers >= 500)  return 'Aktivní';
  return 'Začínající';
}

function isRealWebsite(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (LINK_IN_BIO_DOMAINS.some(d => host.includes(d))) return false;
    if (host.includes('instagram.com') || host.includes('facebook.com')) return false;
    return true;
  } catch { return false; }
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

function extractIgUsernames(html: string): string[] {
  const seen = new Set<string>();
  const re = /<a[^>]+class="result__a"[^>]+href="https?:\/\/(?:www\.)?instagram\.com\/([^/"?]+)\/?"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const u = m[1].toLowerCase();
    if (u && u !== 'p' && u !== 'explore' && u !== 'reel' && u !== 'stories' && u.length > 1) seen.add(u);
  }
  return Array.from(seen);
}

async function fetchIgProfile(username: string): Promise<IgLead | null> {
  try {
    const res = await axios.get(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
      headers: { 'User-Agent': MOBILE_UA, 'X-IG-App-ID': '936619743392459', Accept: 'application/json' },
      timeout: 8_000,
    });
    const user = res.data?.data?.user;
    if (!user) return null;
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

export async function searchInstagram(niche: string, location: string): Promise<{ leads: IgLead[]; total: number; error?: string }> {
  const query = `site:instagram.com ${niche}${location ? ' ' + location : ''}`;
  const html = await ddgSearch(query);
  if (!html) return { leads: [], total: 0, error: 'Vyhledávání selhalo. Zkus znovu.' };

  const usernames = extractIgUsernames(html);
  if (usernames.length === 0) {
    // Fallback: broader search
    const html2 = await ddgSearch(`${niche} ${location} instagram`);
    if (html2) usernames.push(...extractIgUsernames(html2));
  }

  if (usernames.length === 0) return { leads: [], total: 0, error: 'Žádné Instagram profily nenalezeny. Zkus jiný obor nebo město.' };

  const profiles: IgLead[] = [];
  for (const username of usernames.slice(0, 15)) {
    await sleep(300);
    const p = await fetchIgProfile(username);
    if (p) profiles.push(p);
  }

  const noWebsite = profiles.filter(p => !p.hasWebsite);
  return { leads: noWebsite.sort((a, b) => b.followers - a.followers), total: profiles.length };
}
