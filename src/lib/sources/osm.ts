import axios from 'axios';
import { resolveNiche } from '../nace-map';
import { CRAWLER_UA } from '../robots';
import type { DiscoverySource, RawLead } from './types';

const ENDPOINT = 'https://overpass-api.de/api/interpreter';
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
    phone: t.phone || t['contact:phone'],
    email: t.email || t['contact:email'],
    website: t.website || t['contact:website'] || t.url,
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

    try {
      const res = await axios.post(ENDPOINT, buildQuery(osm, city, limit), {
        timeout: TIMEOUT_MS,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        // Overpass answers 406 to the default axios User-Agent — it wants callers to say who
        // they are. Verified against the live endpoint: same query, 406 without this, 200 with.
        headers: { 'Content-Type': 'text/plain', 'User-Agent': CRAWLER_UA },
        validateStatus: () => true,
      });
      if (res.status !== 200) return [];

      const elements: OverpassElement[] = res.data?.elements ?? [];
      const leads = elements
        .map(toLead)
        .filter((l): l is RawLead => l !== null)
        .slice(0, limit);

      cache.set(key, { at: Date.now(), leads });
      return leads;
    } catch {
      return [];
    }
  },
};

export { OSM_ATTRIBUTION } from '../attribution';
