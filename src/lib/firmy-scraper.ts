import axios from 'axios';
import * as cheerio from 'cheerio';

export interface FirmyLead {
  name: string;
  phone?: string;
  address: string;
  firmyUrl: string;
  website?: string;
  hasWebsite: boolean;
}

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

async function fetchPage(query: string, region: string, page: number): Promise<FirmyLead[]> {
  const params: Record<string, string> = { q: query, region };
  if (page > 1) params.page = String(page);

  try {
    const res = await axios.get('https://www.firmy.cz/', {
      params,
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html',
        'Accept-Language': 'cs-CZ,cs;q=0.9',
      },
      timeout: 12_000,
    });

    const $ = cheerio.load(res.data as string);
    const leads: FirmyLead[] = [];

    $('article.premiseBox').each((_, el) => {
      const name = $(el).find('a.titleLinkOverlay').first().text().trim();
      const firmyUrl = $(el).find('a.titleLinkOverlay').first().attr('href') ?? '';
      if (!name || !firmyUrl) return;

      // a.btn.btn-black = website link button — present only when business has a website
      const webAnchor = $(el).find('a.btn.btn-black').first();
      const hasWebsite = webAnchor.length > 0;
      let website: string | undefined;
      if (hasWebsite) {
        const href = webAnchor.attr('href') ?? '';
        // Strip firmy.cz UTM params to get clean URL
        try { website = new URL(href).origin + new URL(href).pathname; } catch { website = href; }
      }

      const phone = $(el).find('[href^="tel:"]').first().attr('href')?.replace('tel:', '');
      const address = $(el).find('a.noBreak').first().text().trim();

      leads.push({ name, phone, address, firmyUrl, website, hasWebsite });
    });

    return leads;
  } catch {
    return [];
  }
}

export async function searchFirmy(
  query: string,
  region: string
): Promise<{ leads: FirmyLead[]; total: number; error?: string }> {
  if (!query.trim()) return { leads: [], total: 0, error: 'Zadej obor.' };

  // Pages 1-2 are mostly premium (all have websites).
  // Pages 3-8 include non-premium businesses more likely to lack a website.
  const pageNums = [1, 2, 3, 4, 5, 6, 7, 8];
  const pages = await Promise.all(pageNums.map(p => fetchPage(query, region, p)));
  const all = pages.flat();

  // Deduplicate by firmyUrl
  const seen = new Set<string>();
  const unique = all.filter(l => {
    if (!l.firmyUrl || seen.has(l.firmyUrl)) return false;
    seen.add(l.firmyUrl);
    return true;
  });

  if (unique.length === 0) {
    return { leads: [], total: 0, error: 'Žádné výsledky. Zkus jiný obor nebo region.' };
  }

  const noWebsite = unique.filter(l => !l.hasWebsite);
  return { leads: noWebsite, total: unique.length };
}
