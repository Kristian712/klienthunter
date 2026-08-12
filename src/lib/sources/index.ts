import { aresSource } from './ares';
import { osmSource } from './osm';
import { aresRzpSource } from './ares-rzp';
import { dphSource } from './dph';
import type { DiscoverySource, EnrichmentSource, RawLead } from './types';

export type { RawLead, DiscoverySource, EnrichmentSource } from './types';
export { extractContacts } from './site-contacts';
export { OSM_ATTRIBUTION } from './osm';

/**
 * Every source in the product, and the only place that decides which ones run.
 *
 * Google Places and Firmy.cz were removed in Vlna 2 on legal grounds, not technical ones:
 * Google Maps Platform ToS § 3.2.3(a) forbids storing business names and addresses outside
 * their services, and Firmy.cz robots.txt ends in a blanket `Disallow: /`. Neither may come
 * back without a written licence.
 */
export const DISCOVERY_SOURCES: DiscoverySource[] = [aresSource, osmSource];

export const ENRICHMENT_SOURCES: EnrichmentSource[] = [aresRzpSource, dphSource];

/**
 * Runs every discovery source and returns their leads grouped by source, in registration
 * order. A source that fails or times out contributes an empty list — the search goes on.
 */
export async function discoverAll(
  niche: string,
  city: string,
  limit: number,
): Promise<RawLead[][]> {
  return Promise.all(
    DISCOVERY_SOURCES.map(s => s.search(niche, city, limit).catch(() => [] as RawLead[])),
  );
}
