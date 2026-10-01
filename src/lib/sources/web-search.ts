import axios from 'axios';

/**
 * Poslední instance, když se doména z názvu firmy odvodit nedá: zeptat se vyhledávače.
 *
 * Proč to tu je: dohledávání podle názvu najde web u čtyř z pěti firem, které ho mají (změřeno
 * na šedesáti firmách se známým webem, 48/60). Ta pětina, která zbývá, má doménu, kterou z názvu
 * uhodnout nejde — `euro-dent.cz` u „EuroDent Ostrava", `kvtas.cz` u „Karlovarská teplárenská".
 * Vyhledávač je jediný způsob, jak se k nim dostat.
 *
 * Proč je to vypnuté: každý dotaz stojí peníze. Brave (tarif Search, ověřeno 11. 9. 2026) účtuje
 * $5 za 1 000 dotazů a měsíčně k tomu dává kredit $5, tedy zhruba 1 000 dotazů zdarma. Zapíná se
 * dvěma proměnnými najednou — klíčem `BRAVE_SEARCH_API_KEY` a vypínačem `WEB_SEARCH_ENABLED=1`,
 * viz `webSearchEnabled`. Bez obou se nestane nic a aplikace se chová přesně jako dosud.
 *
 * Co tenhle modul **nedělá**: nerozhoduje, čí web to je. Vrací jen adresy, které vyhledávač
 * nabídl; jestli stránka patří té firmě, se pozná dál důkazem na stránce (`pageEvidence`, a pro
 * výsledky vyhledávače `searchPageEvidence`). Vyhledávač je nový zdroj hypotéz, ne nový zdroj pravdy.
 *
 * Na jeho odpovědi ale stojí verdikt „web nemá": bez ní aplikace smí říct nejvýš „nevíme" (viz
 * `verifyWebsite`). Proto `searchDomains` vrací i to, jestli vyhledávač vůbec odpověděl.
 */

export const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

/**
 * Rozestup mezi dotazy. Zbytek z doby volného tarifu (1 dotaz/s); tarif Search dnes pouští
 * 50 dotazů/s (ověřeno 11. 9. 2026). Hodnota se upraví podle měření, až bude jasné, kolik dotazů
 * jedno hledání spotřebuje.
 */
// Linkup frontu po 1,1 s nepotřebuje: sto dotazů jednoho hledání tak čekalo přes dvě minuty
// a firmy končily „nestihli jsme ověřit" (1. 10. 2026). Brave zůstává na původním rozestupu.
const MIN_GAP_MS = Number(process.env.WEB_SEARCH_GAP_MS ?? (process.env.LINKUP_API_KEY ? 150 : 1_100));
const TIMEOUT_MS = 6_000;

/**
 * Adresáře, katalogy a rejstříky. Jejich stránka o firmě není web firmy — a je to přesně ten
 * druh odkazu, který u malých firem obsadí celý první výsledek.
 */
export const NOT_A_WEBSITE = [
  'firmy.cz', 'najisto.cz', 'zlatestranky.cz', 'edb.cz', 'firmablizko.cz', 'chytryrejstrik.cz',
  'rejstriky.finance.cz', 'rejstrik.penize.cz', 'podnikatel.cz', 'kurzy.cz', 'finmag.cz',
  'ares.gov.cz', 'justice.cz', 'mapy.cz', 'mapy.com', 'openstreetmap.org', 'wikipedia.org',
  'facebook.com', 'instagram.com', 'linkedin.com', 'youtube.com', 'tiktok.com', 'x.com',
  'twitter.com', 'seznam.cz', 'google.com', 'bing.com', 'yelp.com', 'foursquare.com',
  'kdomestriha.cz', 'salonkee.cz', 'rezervanto.cz', 'nejlepsi-sluzby.cz', 'sluzby.cz',
  // Ubytovací a cestovní katalogy (1. 10. 2026): u hotelu obsadí všechna první místa výsledku.
  'booking.com', 'airbnb.com', 'airbnb.cz', 'trip.com', 'expedia.com', 'expedia.cz', 'hotels.com',
  'trivago.cz', 'trivago.com', 'tripadvisor.com', 'tripadvisor.cz', 'kudyznudy.cz', 'hotel.cz',
  'hportal.cz', 'ubyter.cz', 'e-chalupy.cz', 'megaubytovani.cz', 'czechhotels.info', 'hotelmix.co.uk',
  'guestreservations.com', 'meetselect.com', 'planetofhotels.com', 'hrs.com', 'travelweekly.com',
  'booked.cz', 'booked.net', 'reserving.com', 'cleartrip.com', 'hotel.info', 'agoda.com',
  'kayak.com', 'ubytovanivcr.cz', 'ubytujsenaplno.cz', 'turistika.cz', 'near-place.com',
  'restu.cz', 'menicka.cz', 'zomato.com', 'hladjakprase.cz', 'ceske-hospudky.cz',
  'pilsenhotelspage.com', 'hotelsplzen.com', 'hotelyplzen.net', 'o-hotel.cz', 'ubytovani-plzen.info',
  'firmyvdosahu.cz', 'firmyvkraji.cz', 'detail.cz', 'expanzo.com', 'portalridice.cz', 'ceskehory.cz',
  'eubytko.cz', 'svetubytovani.cz', 'krusnohorci.cz', 'zenhotels.com', 'airpaz.com', 'novostavby.com',
  'momondo.com', 'hotelscombined.com', 'hotelplanner.com', 'yelp.com', 'hotel-u.cz', 'ubytovani.cz',
  'rejstrik-firem.kurzy.cz', 'or.justice.cz', 'imsp.cz', 'kontaktyfirem.cz', 'abc-firmy.cz',
];

/**
 * Vyhledávač běží jen s klíčem **a zároveň** s výslovným `WEB_SEARCH_ENABLED=1`.
 *
 * Klíč samotný nestačí schválně. Majitel ho ukládá do Vercelu dřív, než je rozhodnuto, že se
 * vyhledávač v produkci použije, a první nasazení po uložení klíče by ho jinak začalo používat
 * — s náklady a se změnou verdiktů, které ještě nikdo neschválil. Měřicí skripty si vypínač
 * nastavují samy, jen pro svůj běh.
 */
export function webSearchEnabled(): boolean {
  return Boolean(process.env.LINKUP_API_KEY || process.env.BRAVE_SEARCH_API_KEY) && process.env.WEB_SEARCH_ENABLED === '1';
}

/**
 * Linkup (Paříž) — bezplatná cesta. Majitel 1. 10. 2026: „chci to celé zadarmo", Brave chce kartu.
 * Linkup každý měsíc dobije účet na 20 $ (standardní vyhledávání 0,005 $ → ~4 000 dotazů), bez
 * předplatného (docs.linkup.so/pages/documentation/platform/pricing, ověřeno 1. 10. 2026).
 * Google Custom Search je pro nové zákazníky zavřený, Bing API zrušené (srpen 2025), Tavily
 * podmínkami zakazuje zpřístupnit výstupy třetím stranám. Má-li nasazení oba klíče, vede Linkup.
 */
export const LINKUP_ENDPOINT = 'https://api.linkup.so/v1/search';

let posledni = 0;

/** Rozestup mezi dotazy. Fronta je procesová, protože limit je na klíč, ne na firmu. */
async function throttle(): Promise<void> {
  const cekat = posledni + MIN_GAP_MS - Date.now();
  posledni = Date.now() + Math.max(0, cekat);
  if (cekat > 0) await new Promise(r => setTimeout(r, cekat));
}

function usableHost(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (NOT_A_WEBSITE.some(d => host === d || host.endsWith('.' + d))) return null;
    return host;
  } catch {
    return null;
  }
}

export interface SearchAnswer {
  /**
   * Vyhledávač opravdu odpověděl (HTTP 200). Jen tehdy smí jeho ticho něco znamenat — prázdný
   * výsledek po chybě nebo po překročení limitu není důkaz, že firma web nemá.
   */
  ok: boolean;
  hosts: string[];
  /**
   * Titulek a úryvek každého výsledku (i katalogů, které se do `hosts` nedostaly). Podle nich
   * se pozná, že vyhledávač firmu vůbec zná — jen pak smí jeho ticho znamenat „web nemá".
   */
  texts: string[];
}

/**
 * Domény, které vyhledávač nabídl k dotazu. Nejvýš `limit`, bez adresářů a sociálních sítí,
 * bez duplicit. Nikdy nevyhodí výjimku: když vyhledávač selže, vrátí `ok: false` a hledání
 * pokračuje bez něj.
 */
export async function searchDomains(query: string, limit = 3): Promise<SearchAnswer> {
  if (process.env.LINKUP_API_KEY) return searchLinkup(query, limit, process.env.LINKUP_API_KEY);
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return { ok: false, hosts: [], texts: [] };

  try {
    await throttle();
    const res = await axios.get(BRAVE_ENDPOINT, {
      params: { q: query, country: 'cz', search_lang: 'cs', count: 10, safesearch: 'off' },
      headers: { Accept: 'application/json', 'X-Subscription-Token': key },
      timeout: TIMEOUT_MS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      validateStatus: () => true,
    });
    if (res.status !== 200) return { ok: false, hosts: [], texts: [] };

    const results: Array<{ url?: string; title?: string; description?: string }> = res.data?.web?.results ?? [];
    const hosts: string[] = [];
    for (const r of results) {
      const host = r.url ? usableHost(r.url) : null;
      if (host && !hosts.includes(host)) hosts.push(host);
      if (hosts.length >= limit) break;
    }
    return { ok: true, hosts, texts: results.map(r => `${r.title ?? ''} ${r.description ?? ''}`) };
  } catch {
    return { ok: false, hosts: [], texts: [] };
  }
}

/** Totéž přes Linkup. Adresáře a sítě se vyřadí už v dotazu, ať nežerou místa ve výsledku. */
async function searchLinkup(query: string, limit: number, key: string): Promise<SearchAnswer> {
  try {
    await throttle();
    const res = await axios.post(LINKUP_ENDPOINT, {
      // Linkup hledá přirozeným jazykem — uvozovky z dotazu pro Brave by mu jen překážely.
      q: query.replace(/"/g, ''),
      // `fast` stojí stejně jako `standard` (0,005 $) a odpoví rychleji — na otázku má/nemá web stačí.
      depth: 'fast',
      outputType: 'searchResults',
      maxResults: 10,
      excludeDomains: NOT_A_WEBSITE.slice(0, 100),
    }, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${key}` },
      timeout: TIMEOUT_MS * 2,
      signal: AbortSignal.timeout(TIMEOUT_MS * 2),
      validateStatus: () => true,
    });
    if (res.status !== 200) {
      console.warn('web-search (linkup):', res.status);
      return { ok: false, hosts: [], texts: [] };
    }
    const results: Array<{ url?: string; name?: string; content?: string }> = res.data?.results ?? [];
    const hosts: string[] = [];
    for (const r of results) {
      const host = r.url ? usableHost(r.url) : null;
      if (host && !hosts.includes(host)) hosts.push(host);
      if (hosts.length >= limit) break;
    }
    return { ok: true, hosts, texts: results.map(r => `${r.name ?? ''} ${(r.content ?? '').slice(0, 600)}`) };
  } catch (err) {
    console.warn('web-search (linkup):', err instanceof Error ? err.message : err);
    return { ok: false, hosts: [], texts: [] };
  }
}
