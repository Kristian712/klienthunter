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

async function fetchPage(
  query: string,
  region: string,
  page: number,
): Promise<{ leads: FirmyLead[]; empty: boolean }> {
  const params: Record<string, string> = { q: query };
  if (region) params.region = region;
  if (page > 1) params.page = String(page);

  try {
    const res = await axios.get('https://www.firmy.cz/', {
      params,
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html',
        'Accept-Language': 'cs-CZ,cs;q=0.9',
        Referer: 'https://www.firmy.cz/',
      },
      timeout: 15_000,
    });

    const $ = cheerio.load(res.data as string);
    const articles = $('article.premiseBox');
    if (articles.length === 0) return { leads: [], empty: true };

    const leads: FirmyLead[] = [];

    articles.each((_, el) => {
      const nameEl = $(el).find('a.titleLinkOverlay').first();
      const name = nameEl.text().trim() || nameEl.attr('title')?.trim() || '';
      const firmyUrl = nameEl.attr('href') ?? '';
      if (!name || !firmyUrl) return;

      const webAnchor = $(el).find('a.btn-black, a[title="Web"]').first();
      const hasWebsite = webAnchor.length > 0;
      let website: string | undefined;
      if (hasWebsite) {
        const href = webAnchor.attr('href') ?? '';
        try {
          const u = new URL(href);
          website = u.origin + u.pathname;
        } catch { website = href; }
      }

      const phone = $(el).find('[href^="tel:"]').first().attr('href')?.replace('tel:', '').trim();
      const address = $(el).find('address a.noBreak, a.noBreak').first().text().trim();

      leads.push({ name, phone, address, firmyUrl, website, hasWebsite });
    });

    return { leads, empty: leads.length === 0 };
  } catch {
    return { leads: [], empty: true };
  }
}

export async function searchFirmy(
  query: string,
  region: string,
  options: { onlyNoWebsite?: boolean; maxPages?: number } = {},
): Promise<{ leads: FirmyLead[]; total: number; error?: string }> {
  const { onlyNoWebsite = true, maxPages = 20 } = options;
  if (!query.trim()) return { leads: [], total: 0, error: 'Zadej obor.' };

  const BATCH = 5;
  const seen = new Set<string>();
  const all: FirmyLead[] = [];

  for (let start = 1; start <= maxPages; start += BATCH) {
    const batch = Array.from({ length: BATCH }, (_, i) => start + i).filter(p => p <= maxPages);
    const results = await Promise.all(batch.map(p => fetchPage(query, region, p)));

    let allEmpty = true;
    for (const { leads, empty } of results) {
      if (!empty) allEmpty = false;
      for (const lead of leads) {
        if (!seen.has(lead.firmyUrl)) {
          seen.add(lead.firmyUrl);
          all.push(lead);
        }
      }
    }

    if (allEmpty && start > 1) break;
  }

  if (all.length === 0) {
    return { leads: [], total: 0, error: 'Žádné výsledky. Zkus jiný obor nebo region.' };
  }

  const leads = onlyNoWebsite ? all.filter(l => !l.hasWebsite) : all;
  return { leads, total: all.length };
}
