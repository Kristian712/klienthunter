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

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function ddgSearch(query: string): Promise<string | null> {
  try {
    const res = await axios.post(
      'https://html.duckduckgo.com/html/',
      new URLSearchParams({ q: query, kl: 'cs-cz' }).toString(),
      {
        headers: {
          'User-Agent': BROWSER_UA,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'cs,en;q=0.9',
        },
        timeout: 12_000,
        maxRedirects: 3,
      }
    );
    return typeof res.data === 'string' ? res.data : null;
  } catch {
    return null;
  }
}

const SKIP_SLUGS = new Set([
  'groups', 'groups_browse', 'pages', 'search', 'events',
  'marketplace', 'login', 'home', 'watch', 'gaming', 'business',
  'hashtag', 'share', 'sharer', 'dialog', 'help', 'policies',
]);

interface ParsedPage {
  name: string;
  fbPath: string;
}

function parseFbPages(html: string): ParsedPage[] {
  const results: ParsedPage[] = [];
  const seen = new Set<string>();

  // DDG result__a anchors point directly to facebook.com
  const re =
    /<a[^>]+class="result__a"[^>]+href="(https?:\/\/(?:www\.)?facebook\.com\/([^"/?]+)[^"]*)"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const fullUrl = m[1];
    const pathSlug = decodeURIComponent(m[2]);
    const rawTitle = m[3].trim();

    if (SKIP_SLUGS.has(pathSlug)) continue;
    if (fullUrl.includes('/groups/')) continue;
    if (seen.has(pathSlug)) continue;
    seen.add(pathSlug);

    const name = rawTitle.replace(/\s*[-|]\s*Facebook\s*$/i, '').trim();
    if (!name || name.length < 3) continue;

    results.push({ name, fbPath: '/' + pathSlug });
  }

  return results;
}

async function checkHasWebsite(name: string): Promise<{ hasWebsite: boolean; website?: string }> {
  const query = `"${name}" -site:facebook.com -site:instagram.com -site:linkedin.com -site:tiktok.com -site:youtube.com -site:firmy.cz -site:zivefirmy.cz`;
  const html = await ddgSearch(query);
  if (!html) return { hasWebsite: false };

  const urlRe = /<a[^>]+class="result__url"[^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(html)) !== null) {
    const url = m[1].trim().toLowerCase().replace(/^www\./, '');
    if (
      url.length > 4 &&
      url.includes('.') &&
      !url.includes('facebook.com') &&
      !url.includes('instagram.com') &&
      !url.includes('linkedin.com') &&
      !url.includes('twitter.com') &&
      !url.includes('x.com') &&
      !url.includes('youtube.com') &&
      !url.includes('tiktok.com') &&
      !url.includes('firmy.cz') &&
      !url.includes('zivefirmy.cz') &&
      !url.includes('yelp.com') &&
      !url.includes('tripadvisor') &&
      !url.includes('google.com') &&
      !url.includes('wikipedia') &&
      !url.includes('mapy.cz')
    ) {
      return { hasWebsite: true, website: url };
    }
  }

  return { hasWebsite: false };
}

export async function scrapeFacebookGroup(
  groupInput: string
): Promise<{ leads: FbLead[]; error?: string }> {
  const niche = groupInput.trim();
  if (!niche) return { leads: [], error: 'Zadej obor a město.' };

  // Run 3 query variants to collect more results
  const queries = [
    `site:facebook.com ${niche}`,
    `site:facebook.com "${niche}"`,
    `${niche} facebook stránka`,
  ];

  const allPages = new Map<string, ParsedPage>();

  for (const q of queries) {
    const html = await ddgSearch(q);
    if (html) {
      for (const p of parseFbPages(html)) {
        if (!allPages.has(p.fbPath)) allPages.set(p.fbPath, p);
      }
    }
    await sleep(400);
  }

  if (allPages.size === 0) {
    return {
      leads: [],
      error: `Žádné Facebook stránky nenalezeny pro „${niche}". Zkus jiný obor nebo město.`,
    };
  }

  // Check up to 20 pages for website
  const pages = Array.from(allPages.values()).slice(0, 20);
  const leads: FbLead[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    await sleep(500);
    const { hasWebsite, website } = await checkHasWebsite(page.name);

    const score = Math.max(25, 95 - i * 4);
    const label = score >= 80 ? 'Velmi aktivní' : score >= 55 ? 'Aktivní' : 'Méně aktivní';

    leads.push({
      name: page.name,
      profileUrl: page.fbPath,
      facebookPageUrl: `https://www.facebook.com${page.fbPath}`,
      hasWebsite,
      website,
      isPage: true,
      postCount: 1,
      activityScore: score,
      activityLabel: label,
    });
  }

  const noWebsite = leads.filter(l => !l.hasWebsite);

  if (noWebsite.length === 0 && leads.length > 0) {
    return {
      leads: [],
      error: 'Všichni nalezení mají pravděpodobně web. Zkus jiný obor nebo město.',
    };
  }

  return { leads: noWebsite };
}
