import axios from 'axios';

/**
 * Poslední instance, když se doména z názvu firmy odvodit nedá: zeptat se vyhledávače.
 *
 * Proč to tu je: dohledávání podle názvu najde web u čtyř z pěti firem, které ho mají (změřeno
 * na šedesáti firmách se známým webem, 48/60). Ta pětina, která zbývá, má doménu, kterou z názvu
 * uhodnout nejde — `euro-dent.cz` u „EuroDent Ostrava", `kvtas.cz` u „Karlovarská teplárenská".
 * Vyhledávač je jediný způsob, jak se k nim dostat.
 *
 * Proč je to vypnuté, dokud nedostane klíč: každý dotaz stojí peníze nebo kvótu. Brave dává
 * zdarma 2 000 dotazů měsíčně, což vystačí na pár hledání po pěti stech firmách; bez klíče se
 * nestane nic a aplikace se chová přesně jako dosud. Zapíná se proměnnou `BRAVE_SEARCH_API_KEY`.
 *
 * Co tenhle modul **nedělá**: nerozhoduje, čí web to je. Vrací jen adresy, které vyhledávač
 * nabídl; jestli stránka patří té firmě, se pozná dál stejným důkazem jako u uhodnutých domén
 * (`pageEvidence`). Vyhledávač je nový zdroj hypotéz, ne nový zdroj pravdy.
 */

const ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

/** Brave na volném tarifu pouští jeden dotaz za sekundu; víc znamená 429. */
const MIN_GAP_MS = Number(process.env.WEB_SEARCH_GAP_MS ?? 1_100);
const TIMEOUT_MS = 6_000;

/**
 * Adresáře, katalogy a rejstříky. Jejich stránka o firmě není web firmy — a je to přesně ten
 * druh odkazu, který u malých firem obsadí celý první výsledek.
 */
const NOT_A_WEBSITE = [
  'firmy.cz', 'najisto.cz', 'zlatestranky.cz', 'edb.cz', 'firmablizko.cz', 'chytryrejstrik.cz',
  'rejstriky.finance.cz', 'rejstrik.penize.cz', 'podnikatel.cz', 'kurzy.cz', 'finmag.cz',
  'ares.gov.cz', 'justice.cz', 'mapy.cz', 'mapy.com', 'openstreetmap.org', 'wikipedia.org',
  'facebook.com', 'instagram.com', 'linkedin.com', 'youtube.com', 'tiktok.com', 'x.com',
  'twitter.com', 'seznam.cz', 'google.com', 'bing.com', 'yelp.com', 'foursquare.com',
  'kdomestriha.cz', 'salonkee.cz', 'rezervanto.cz', 'nejlepsi-sluzby.cz', 'sluzby.cz',
];

export function webSearchEnabled(): boolean {
  return Boolean(process.env.BRAVE_SEARCH_API_KEY);
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

/**
 * Domény, které vyhledávač nabídl k dotazu. Nejvýš `limit`, bez adresářů a sociálních sítí,
 * bez duplicit. Nikdy nevyhodí výjimku: když vyhledávač selže, hledání pokračuje bez něj.
 */
export async function searchDomains(query: string, limit = 3): Promise<string[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return [];

  try {
    await throttle();
    const res = await axios.get(ENDPOINT, {
      params: { q: query, country: 'cz', search_lang: 'cs', count: 10, safesearch: 'off' },
      headers: { Accept: 'application/json', 'X-Subscription-Token': key },
      timeout: TIMEOUT_MS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      validateStatus: () => true,
    });
    if (res.status !== 200) return [];

    const results: Array<{ url?: string }> = res.data?.web?.results ?? [];
    const hosts: string[] = [];
    for (const r of results) {
      const host = r.url ? usableHost(r.url) : null;
      if (host && !hosts.includes(host)) hosts.push(host);
      if (hosts.length >= limit) break;
    }
    return hosts;
  } catch {
    return [];
  }
}
