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

// ── DDG HTML search ───────────────────────────────────────────────────────────

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

// ── Parse FB profile/page paths out of DDG result HTML ───────────────────────

interface DdgResult {
  title: string;
  snippet: string;
  fbPath: string; // e.g. /JanNovakInstalace or /profile.php?id=123
}

function parseDdgResults(html: string, skipGroupPath: string): DdgResult[] {
  const results: DdgResult[] = [];

  // DDG wraps links in /l/?uddg=ENCODED_URL – extract the encoded URL
  const linkRe = /uddg=(https?%3A%2F%2F(?:www\.)?facebook\.com%2F[^&"'\s]+)/gi;
  // Also catch plain facebook.com URLs in visible text
  const plainRe = /(?:https?:\/\/)?(?:www\.)?facebook\.com\/([\w.]+(?:\/[\w.]+)*)/gi;

  // Extract title + snippet pairs (DDG uses class="result__a" for title, result__snippet for body)
  const blockRe = /<a[^>]+class="result__a"[^>]*>([^<]+)<\/a>[\s\S]{0,800}?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  // Collect result blocks
  const blocks: { title: string; snippet: string; block: string }[] = [];
  let bm: RegExpExecArray | null;
  while ((bm = blockRe.exec(html)) !== null) {
    blocks.push({
      title: bm[1].replace(/<[^>]+>/g, '').trim(),
      snippet: bm[2].replace(/<[^>]+>/g, '').trim(),
      block: bm[0],
    });
  }

  const seen = new Set<string>();

  for (const { title, snippet, block } of blocks) {
    // Try to extract FB URL from the block
    let fbPath: string | null = null;

    // Priority: uddg encoded URL
    const um = linkRe.exec(block);
    linkRe.lastIndex = 0;
    if (um) {
      try {
        const decoded = decodeURIComponent(um[1]);
        const u = new URL(decoded);
        fbPath = u.pathname + (u.search || '');
      } catch { /* skip */ }
    }

    // Fallback: plain fb URL in block text
    if (!fbPath) {
      const pm = plainRe.exec(block);
      plainRe.lastIndex = 0;
      if (pm) fbPath = '/' + pm[1];
    }

    if (!fbPath) continue;

    // Normalise profile.php?id=NNN
    if (fbPath.includes('profile.php')) {
      const idMatch = fbPath.match(/id=(\d+)/);
      if (idMatch) fbPath = `/profile.php?id=${idMatch[1]}`;
      else continue;
    } else {
      // Keep only first path segment (the page/profile slug)
      const parts = fbPath.replace(/\/$/, '').split('/').filter(Boolean);
      if (parts.length === 0) continue;
      fbPath = '/' + parts[0];
    }

    // Skip the group itself and generic FB paths
    if (
      fbPath === skipGroupPath ||
      /^\/(groups|search|hashtag|pages|events|marketplace|login|register|home)$/i.test(fbPath)
    ) continue;

    if (seen.has(fbPath)) continue;
    seen.add(fbPath);

    results.push({ title, snippet, fbPath });
  }

  return results;
}

// ── Check if a person has a website via DDG ───────────────────────────────────

async function checkHasWebsite(name: string, fbPath: string): Promise<{ hasWebsite: boolean; website?: string }> {
  // Search for the name excluding social platforms — if a real website exists, it'll surface
  const query = `"${name}" -site:facebook.com -site:instagram.com -site:linkedin.com -site:tiktok.com`;
  const html = await ddgSearch(query);
  if (!html) return { hasWebsite: false };

  // Look for a result URL that isn't social and looks like a real website
  const urlRe = /class="result__url"[^>]*>([^<]+)</gi;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(html)) !== null) {
    const url = m[1].trim().toLowerCase();
    if (
      url &&
      !url.includes('facebook.com') &&
      !url.includes('instagram.com') &&
      !url.includes('linkedin.com') &&
      !url.includes('twitter.com') &&
      !url.includes('youtube.com') &&
      url.includes('.') &&
      url.length > 6
    ) {
      return { hasWebsite: true, website: url.startsWith('http') ? url : 'https://' + url };
    }
  }

  return { hasWebsite: false };
}

// ── Normalise group input to slug ─────────────────────────────────────────────

function extractGroupSlug(input: string): string {
  let s = input.trim();
  s = s.replace(/^https?:\/\/(www\.|m\.|mbasic\.)?facebook\.com\/groups\//i, '');
  s = s.replace(/^https?:\/\/fb\.com\/groups\//i, '');
  s = s.replace(/[/?#].*$/, '');
  return s;
}

function activityLabel(rank: number, total: number): { score: number; label: string } {
  const pct = 1 - rank / total;
  if (pct > 0.7) return { score: 90, label: 'Velmi aktivní' };
  if (pct > 0.4) return { score: 65, label: 'Aktivní' };
  return { score: 35, label: 'Méně aktivní' };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function scrapeFacebookGroup(
  groupInput: string
): Promise<{ leads: FbLead[]; error?: string }> {
  const slug = extractGroupSlug(groupInput);
  if (!slug) return { leads: [], error: 'Zadej platný odkaz nebo název skupiny.' };

  // Step 1: search DDG for posts/members in this group
  const html = await ddgSearch(`site:facebook.com/groups/${slug}`);
  if (!html) return { leads: [], error: 'Vyhledávání selhalo – zkus to znovu.' };

  // Step 2: parse FB profiles from results
  const groupFbPath = `/groups/${slug}`;
  const ddgResults = parseDdgResults(html, groupFbPath);

  if (ddgResults.length === 0) {
    return {
      leads: [],
      error: 'Skupina nebyla nalezena nebo je soukromá. Zkontroluj název a ujisti se, že je skupina veřejná.',
    };
  }

  // Step 3: for each profile, check website via DDG (max 20)
  const top = ddgResults.slice(0, 20);
  const leads: FbLead[] = [];

  for (let i = 0; i < top.length; i++) {
    const r = top[i];
    await sleep(600); // polite delay between DDG requests
    const { hasWebsite, website } = await checkHasWebsite(r.title, r.fbPath);
    const { score, label } = activityLabel(i, top.length);

    // Detect if it's a Page (has a category-like snippet or business keywords)
    const isPage = /stránka|fanpage|page|podnikání|service|services|firma|studio|salon/i.test(
      r.snippet + r.title
    );

    leads.push({
      name: r.title,
      profileUrl: r.fbPath,
      facebookPageUrl: `https://www.facebook.com${r.fbPath}`,
      hasWebsite,
      website,
      isPage,
      postCount: 1,
      activityScore: score,
      activityLabel: label,
    });
  }

  const noWebsite = leads.filter(l => !l.hasWebsite);

  if (noWebsite.length === 0 && leads.length > 0) {
    return {
      leads: [],
      error: 'Všichni nalezení přispěvatelé pravděpodobně web mají. Zkus jinou skupinu.',
    };
  }

  return { leads: noWebsite };
}
