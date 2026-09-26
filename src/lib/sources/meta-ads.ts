import { prisma } from '../db';
import { GENERIC_TOKENS, normalizeName } from '../website-status';

/**
 * Meta Knihovna reklam (Ad Library API) — kdo v okolí platí za reklamu.
 *
 * Od DSA jsou v EU veřejné všechny reklamy z posledního roku, ne jen politické, a Meta k nim
 * dává bezplatné API (`GET /ads_archive`). Přístup vyžaduje osobně ověřenou totožnost
 * (facebook.com/ID) a token aplikace — `META_AD_LIBRARY_TOKEN`. Bez tokenu se tenhle zdroj
 * neozve a filtry, které na něm stojí, jsou v UI zamčené s vysvětlením.
 *
 * Co se z API bere a co ne (průzkum 15. 9. 2026):
 *  - cílová URL reklamy v API NENÍ; jediný signál, kam reklama vede, je doména v
 *    `ad_creative_link_captions`. Reklama bez ní je video, událost, aplikace nebo „odkaz v BIO"
 *    — tedy firma, která platí, ale na web nevede;
 *  - útrata je jen u politických reklam; `eu_total_reach` je jediný náznak rozpočtu;
 *  - filtr podle oboru neexistuje, hledá se klíčovým slovem (město) v textu reklam;
 *  - `beneficiary_payers` (EU) nese plátce — často právní název firmy, nejlepší klíč k ARESu.
 *
 * Ukládá se jen agregát na stránku (název, plátce, doména, počet, začátek, dosah), nikdy text
 * reklamy. Limit API je nominálně 200 volání za hodinu a škrtí dynamicky (chyba 613), proto
 * cache na město sedm dní a nejvýš `MAX_PAGES` stránek na dotaz.
 */

export interface AdsSignal {
  pageId: string;
  pageName: string;
  /** Začátek nejstarší běžící reklamy. */
  since: Date | null;
  count: number;
  /** Doména, kam reklamy vedou; null = žádná reklama nevede na web. */
  linkDomain: string | null;
  reach: number | null;
}

export interface Advertiser extends AdsSignal {
  payer: string | null;
}

const API_VERSION = 'v21.0';
const PAGE_SIZE = 100;
/** 8 × 100 reklam na město — u krajského města je jich víc, ale dál už jde o celostátní značky. */
const MAX_PAGES = 8;
const CACHE_DAYS = 7;
const REQUEST_TIMEOUT_MS = 12_000;

export function metaAdsEnabled(): boolean {
  return Boolean(process.env.META_AD_LIBRARY_TOKEN);
}

/** Tvar záznamu z `ads_archive`, jen pole, která čteme. */
export interface ArchivedAd {
  page_id?: string;
  page_name?: string;
  ad_creative_link_captions?: string[];
  ad_delivery_start_time?: string;
  eu_total_reach?: number | string;
  beneficiary_payers?: Array<{ payer?: string; beneficiary?: string } | string>;
}

const META_HOSTS = /(^|\.)(facebook|instagram|messenger|whatsapp|fb)\.(com|me)$|^wa\.me$|^fb\.me$/;

/** Doména z popisku odkazu („SHOP.MJCZLIN.CZ", „https://www.wondeco.cz/"). Odkazy zpět do Meta nejsou web firmy. */
export function domainOf(caption: string | null | undefined): string | null {
  if (!caption) return null;
  const host = caption.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#\s]/)[0];
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null;
  if (META_HOSTS.test(host)) return null;
  return host;
}

function payerOf(ad: ArchivedAd): string | null {
  for (const p of ad.beneficiary_payers ?? []) {
    const name = typeof p === 'string' ? p : p.payer ?? p.beneficiary;
    if (name && name.trim()) return name.trim();
  }
  return null;
}

/** Z reklam udělá inzerenty: jedna stránka = jeden řádek, bez textů. Čistá funkce kvůli testům. */
export function aggregateAds(ads: ArchivedAd[]): Advertiser[] {
  const byPage = new Map<string, Advertiser & { domains: Map<string, number>; payers: Map<string, number> }>();
  for (const ad of ads) {
    if (!ad.page_id || !ad.page_name) continue;
    let a = byPage.get(ad.page_id);
    if (!a) {
      a = { pageId: ad.page_id, pageName: ad.page_name, payer: null, since: null, count: 0, linkDomain: null, reach: null, domains: new Map(), payers: new Map() };
      byPage.set(ad.page_id, a);
    }
    a.count++;
    const start = ad.ad_delivery_start_time ? new Date(ad.ad_delivery_start_time) : null;
    if (start && !Number.isNaN(start.getTime()) && (!a.since || start < a.since)) a.since = start;
    const reach = Number(ad.eu_total_reach);
    if (Number.isFinite(reach) && reach > 0 && (a.reach === null || reach > a.reach)) a.reach = reach;
    for (const caption of ad.ad_creative_link_captions ?? []) {
      const d = domainOf(caption);
      if (d) a.domains.set(d, (a.domains.get(d) ?? 0) + 1);
    }
    const payer = payerOf(ad);
    if (payer) a.payers.set(payer, (a.payers.get(payer) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) => Array.from(m.entries()).sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
  return Array.from(byPage.values()).map(({ domains, payers, ...a }) => ({ ...a, linkDomain: top(domains), payer: top(payers) }));
}

async function downloadAds(query: string, token: string, deadlineAt: number): Promise<ArchivedAd[]> {
  const params = new URLSearchParams({
    ad_reached_countries: "['CZ']",
    ad_active_status: 'ACTIVE',
    search_terms: query,
    search_type: 'KEYWORD_UNORDERED',
    fields: 'page_id,page_name,ad_creative_link_captions,ad_delivery_start_time,eu_total_reach,beneficiary_payers',
    limit: String(PAGE_SIZE),
    access_token: token,
  });
  let url: string | null = `https://graph.facebook.com/${API_VERSION}/ads_archive?${params}`;
  const ads: ArchivedAd[] = [];
  for (let page = 0; url && page < MAX_PAGES; page++) {
    if (Date.now() > deadlineAt) break;
    const res = await fetch(url, { signal: AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, Math.max(1000, deadlineAt - Date.now()))) });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // Limit (613) uprostřed stránkování: co už máme, platí; ostatní chyby jsou chyby.
      if (res.status === 400 && /"code":\s*613/.test(body) && ads.length) break;
      throw new Error(`ads_archive ${res.status}: ${body.slice(0, 200)}`);
    }
    const d = await res.json() as { data?: ArchivedAd[]; paging?: { next?: string } };
    ads.push(...(d.data ?? []));
    url = d.paging?.next ?? null;
  }
  return ads;
}

type Row = { pageId: string; pageName: string; payer: string | null; linkDomain: string | null; adCount: number; firstSeenAt: Date | null; reach: number | null };
const fromRow = (r: Row): Advertiser => ({ pageId: r.pageId, pageName: r.pageName, payer: r.payer, linkDomain: r.linkDomain, count: r.adCount, since: r.firstSeenAt, reach: r.reach });

/**
 * Inzerenti pro město — z cache, nebo z API a do cache. Selhání API vrátí, co je v cache
 * (i staré), nebo prázdno; hledání tím nikdy nespadne.
 */
export async function fetchAdvertisers(city: string, deadlineAt: number): Promise<Advertiser[]> {
  const token = process.env.META_AD_LIBRARY_TOKEN;
  const query = city.trim().toLowerCase();
  if (!token || !query) return [];
  const cached = await prisma.metaAdvertiser.findMany({ where: { query } });
  const freshAfter = Date.now() - CACHE_DAYS * 86_400_000;
  if (cached.length && cached[0].fetchedAt.getTime() > freshAfter) return cached.map(fromRow);
  try {
    const advertisers = aggregateAds(await downloadAds(query, token, deadlineAt));
    await prisma.$transaction([
      prisma.metaAdvertiser.deleteMany({ where: { query } }),
      prisma.metaAdvertiser.createMany({
        data: advertisers.map(a => ({ query, pageId: a.pageId, pageName: a.pageName, payer: a.payer, linkDomain: a.linkDomain, adCount: a.count, firstSeenAt: a.since, reach: a.reach })),
      }),
    ]);
    return advertisers;
  } catch (err) {
    console.warn('meta-ads:', query, err instanceof Error ? err.message : err);
    return cached.map(fromRow);
  }
}

export interface AdvertiserIndex {
  byDomain: Map<string, Advertiser>;
  byName: Map<string, Advertiser>;
}

/** `shop.mjczlin.cz` i `www.mjczlin.cz` jsou tatáž firma: porovnává se doména druhého řádu. */
export function baseDomain(host: string): string {
  const parts = host.toLowerCase().split('.').filter(Boolean);
  return parts.length > 2 ? parts.slice(-2).join('.') : parts.join('.');
}

/** Název, podle kterého se dá párovat: dost dlouhý a ne jen oborové slovo („Optika", „Autoservis Zlín"). */
function nameKey(raw: string | null | undefined): string | null {
  const key = normalizeName(raw ?? undefined);
  if (key.length < 6) return null;
  const tokens = key.split(' ');
  if (tokens.every(t => GENERIC_TOKENS.has(t))) return null;
  return key;
}

/** Klíče pro párování: doména odkazu, normalizovaný plátce a normalizovaný název stránky. */
export function indexAdvertisers(advertisers: Advertiser[]): AdvertiserIndex {
  const byDomain = new Map<string, Advertiser>();
  const byName = new Map<string, Advertiser>();
  for (const a of advertisers) {
    if (a.linkDomain) { const d = baseDomain(a.linkDomain); if (!byDomain.has(d)) byDomain.set(d, a); }
    for (const raw of [a.payer, a.pageName]) {
      const key = nameKey(raw);
      if (key && !byName.has(key)) byName.set(key, a);
    }
  }
  return { byDomain, byName };
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; }
}

/**
 * Spáruje firmu s inzerentem: nejdřív doména webu = doména z reklamy (nejjistější), pak název
 * firmy = plátce nebo název stránky po normalizaci. Nespárovaná firma není „neinzeruje",
 * jen „nevíme" — a tak se to i ukazuje.
 */
export function matchAdvertiser(c: { name: string; website?: string }, index: AdvertiserIndex): Advertiser | null {
  const host = hostOf(c.website);
  if (host) { const hit = index.byDomain.get(baseDomain(host)); if (hit) return hit; }
  const key = nameKey(c.name);
  return key ? index.byName.get(key) ?? null : null;
}

export { googleAdsTransparencyUrl } from '../ads-links';
