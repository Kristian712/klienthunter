import axios from 'axios';

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

async function fetchPage(query: string, region: string, page = 1): Promise<FirmyLead[]> {
  const params: Record<string, string> = { q: query, region };
  if (page > 1) params.page = String(page);
  try {
    const res = await axios.get('https://www.firmy.cz/', {
      params,
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html', 'Accept-Language': 'cs-CZ,cs;q=0.9' },
      timeout: 12_000,
    });
    const html: string = res.data;
    const leads: FirmyLead[] = [];
    const jsonldRe = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = jsonldRe.exec(html)) !== null) {
      try {
        const data = JSON.parse(m[1]);
        if (data['@type'] !== 'LocalBusiness' || !data.name) continue;
        const sameAs: string[] = Array.isArray(data.sameAs) ? data.sameAs : [];
        const firmyUrl = sameAs.find((u: string) => u.includes('firmy.cz')) ?? data.url ?? '';
        const externalWebsite = sameAs.find((u: string) => !u.includes('firmy.cz'));
        const addr = data.address;
        const address = addr ? [addr.streetAddress, addr.addressLocality].filter(Boolean).join(', ') : '';
        leads.push({ name: data.name, phone: data.telephone, address, firmyUrl, website: externalWebsite, hasWebsite: Boolean(externalWebsite) });
      } catch { /* skip */ }
    }
    return leads;
  } catch {
    return [];
  }
}

export async function searchFirmy(query: string, region: string): Promise<{ leads: FirmyLead[]; total: number; error?: string }> {
  if (!query.trim()) return { leads: [], total: 0, error: 'Zadej obor.' };
  const pages = await Promise.all([fetchPage(query, region, 1), fetchPage(query, region, 2), fetchPage(query, region, 3)]);
  const all = pages.flat();
  const seen = new Set<string>();
  const unique = all.filter(l => { if (seen.has(l.firmyUrl)) return false; seen.add(l.firmyUrl); return true; });
  if (unique.length === 0) return { leads: [], total: 0, error: 'Žádné výsledky. Zkus jiný obor nebo region.' };
  return { leads: unique.filter(l => !l.hasWebsite), total: unique.length };
}
