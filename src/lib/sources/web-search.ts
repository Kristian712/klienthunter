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
const MIN_GAP_MS = Number(process.env.WEB_SEARCH_GAP_MS ?? 1_100);
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
  return Boolean(process.env.BRAVE_SEARCH_API_KEY) && process.env.WEB_SEARCH_ENABLED === '1';
}

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
}

/**
 * Domény, které vyhledávač nabídl k dotazu. Nejvýš `limit`, bez adresářů a sociálních sítí,
 * bez duplicit. Nikdy nevyhodí výjimku: když vyhledávač selže, vrátí `ok: false` a hledání
 * pokračuje bez něj.
 */
export async function searchDomains(query: string, limit = 3): Promise<SearchAnswer> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return { ok: false, hosts: [] };

  try {
    await throttle();
    const res = await axios.get(BRAVE_ENDPOINT, {
      params: { q: query, country: 'cz', search_lang: 'cs', count: 10, safesearch: 'off' },
      headers: { Accept: 'application/json', 'X-Subscription-Token': key },
      timeout: TIMEOUT_MS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      validateStatus: () => true,
    });
    if (res.status !== 200) return { ok: false, hosts: [] };

    const results: Array<{ url?: string }> = res.data?.web?.results ?? [];
    const hosts: string[] = [];
    for (const r of results) {
      const host = r.url ? usableHost(r.url) : null;
      if (host && !hosts.includes(host)) hosts.push(host);
      if (hosts.length >= limit) break;
    }
    return { ok: true, hosts };
  } catch {
    return { ok: false, hosts: [] };
  }
}
