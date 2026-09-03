import axios from 'axios';
import { resolveNiche } from '../nace-map';
import { CRAWLER_UA } from '../robots';
import { normalizeCzPhone } from './site-contacts';
import type { DiscoverySource, RawLead } from './types';

/**
 * The main instance and one mirror.
 *
 * Not an optimisation: the public Overpass answers 504 often enough that a search can come back
 * with no phones, no e-mails and no websites at all — the user then sees a list of firms and no
 * way to reach any of them, with nothing on screen saying why. Measured by hand: the same query
 * for dentists in Ostrava returned 504 and then 200 with sixteen results a minute later.
 *
 * The mirrors are flaky too, so this is not a guarantee — it just stops one bad minute from
 * emptying the whole search.
 */
const ENDPOINTS = [
  { url: 'https://overpass-api.de/api/interpreter', timeoutMs: 12_000 },
  { url: 'https://overpass.kumi.systems/api/interpreter', timeoutMs: 8_000 },
];
// Kept under the caller's discovery budget: whatever Overpass has not answered in twenty
// seconds is time the website probes need more.
const TIMEOUT_MS = 20_000;
const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * The public Overpass instance asks not to be used as backend infrastructure, so this source
 * is deliberately frugal: exactly one request per search, a short in-process memo for repeats,
 * and a hard timeout. If OSM ever starts refusing us, the fix is our own instance — not more
 * retries. A failure here degrades the search (fewer contacts), it never breaks it.
 */
const cache = new Map<string, { at: number; leads: RawLead[] }>();

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function buildQuery(filters: string[], city: string, limit: number): string {
  const area = city
    ? `area["name"="${city.replace(/"/g, '')}"]["boundary"="administrative"]->.a;`
    : `area["ISO3166-1"="CZ"]["admin_level"="2"]->.a;`;

  const clauses = filters
    .map(f => {
      const [k, v] = f.split('=');
      return `nwr["${k}"="${v}"](area.a);`;
    })
    .join('\n  ');

  return `[out:json][timeout:${Math.floor(TIMEOUT_MS / 1000)}];
${area}
(
  ${clauses}
);
out center tags ${limit};`;
}

/**
 * Z hodnoty tagu udělá adresu profilu — nebo nic.
 *
 * Mapéři to zapisují třemi způsoby: celou adresou, adresou bez protokolu, nebo jen jménem
 * profilu. Přijímáme všechny tři, ale výsledek musí skončit na doméně té sítě: `contact:facebook`
 * občas obsahuje odkaz úplně jinam a takový bychom uživateli podstrčili jako profil firmy.
 */
function socialUrl(raw: string | undefined, host: 'facebook.com' | 'instagram.com'): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;

  // Holé jméno profilu — žádná tečka, žádné lomítko na začátku.
  if (/^[A-Za-z0-9._-]{2,60}$/.test(value) && !value.includes('.')) {
    return `https://www.${host}/${value}`;
  }

  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    if (!/^https?:$/.test(url.protocol)) return undefined;
    const h = url.hostname.replace(/^www\./, '').toLowerCase();
    if (h !== host && !h.endsWith('.' + host)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

const czPhone = (raw: string | undefined): string | undefined =>
  raw ? normalizeCzPhone(raw) ?? undefined : undefined;

function toLead(el: OverpassElement): RawLead | null {
  const t = el.tags ?? {};
  const name = t.name || t['name:cs'] || t.operator;
  if (!name) return null;

  const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
  const address = [street, t['addr:city'], t['addr:postcode']].filter(Boolean).join(', ');

  return {
    sourceId: 'osm',
    externalId: `osm:${el.type}/${el.id}`,
    name,
    /**
     * Telefon se srovnává do jednoho tvaru hned tady.
     *
     * Tagy v OSM píše každý jinak — změřeno na restauracích ve Zlíně: z 31 čísel jich deset
     * přišlo jako `+420577599786`, `777717998` nebo rovnou dvě čísla v jednom poli. Export
     * do CSV pak nese řádky, které se nedají použít k ničemu. Co se srovnat nedá (cizí
     * předvolba, překlep), radši zahodíme — vymyšlené číslo je horší než prázdné pole.
     */
    phone: czPhone(t.phone || t['contact:phone']),
    email: t.email || t['contact:email'],
    website: t.website || t['contact:website'] || t.url,
    // Tagy, které v odpovědi Overpassu už jsou — čtení nic nestojí. Pokrytí je malé (změřeno
    // přes celou ČR: 38 kadeřnictví, 29 restaurací a 4 autoservisy bez webu, ale s profilem),
    // jenže je to přesně ta skupina, kterou uživatel oslovuje přes sítě.
    facebookUrl: socialUrl(t['contact:facebook'] || t.facebook, 'facebook.com'),
    instagramUrl: socialUrl(t['contact:instagram'] || t.instagram, 'instagram.com'),
    address: address || undefined,
    lat: el.lat ?? el.center?.lat,
    lon: el.lon ?? el.center?.lon,
    category: t.shop || t.craft || t.amenity || t.office || t.leisure || t.healthcare,
  };
}

export const osmSource: DiscoverySource = {
  id: 'osm',
  label: 'OpenStreetMap',

  async search(niche: string, city: string, limit: number): Promise<RawLead[]> {
    const { osm } = resolveNiche(niche);
    if (osm.length === 0) return [];

    const key = `${osm.join('|')}::${city}::${limit}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.leads;

    const query = buildQuery(osm, city, limit);

    for (const endpoint of ENDPOINTS) {
      try {
        const res = await axios.post(endpoint.url, query, {
          timeout: endpoint.timeoutMs,
          signal: AbortSignal.timeout(endpoint.timeoutMs),
          // Overpass answers 406 to the default axios User-Agent — it wants callers to say who
          // they are. Verified against the live endpoint: same query, 406 without this, 200 with.
          headers: { 'Content-Type': 'text/plain', 'User-Agent': CRAWLER_UA },
          validateStatus: () => true,
        });
        if (res.status !== 200) continue;

        const elements: OverpassElement[] = res.data?.elements ?? [];
        const leads = elements
          .map(toLead)
          .filter((l): l is RawLead => l !== null)
          .slice(0, limit);

        // An empty answer from a healthy server is an answer: cache it and stop. Only an error
        // or a timeout is worth asking the next instance about.
        cache.set(key, { at: Date.now(), leads });
        return leads;
      } catch {
        /* try the next instance */
      }
    }

    return [];
  },
};

export { OSM_ATTRIBUTION } from '../attribution';
