import { aresSource } from './ares';
import { osmSource } from './osm';
import { aresRzpSource } from './ares-rzp';
import { aresResSource } from './ares-res';
import { dphSource } from './dph';
import { registryCanServe, registryDiscover, type RegistryQuery } from './registry';
import type { DiscoverySource, EnrichmentSource, RawLead } from './types';
export type { DiscoveryOptions } from './types';
export type { TradeLicence } from './types';

export type { RawLead, DiscoverySource, EnrichmentSource, MatchedBy } from './types';
export { extractContacts, contactPageUrl } from './site-contacts';
export { OSM_ATTRIBUTION } from './osm';
export { registryCanServe } from './registry';
export type { RegistryQuery } from './registry';

/**
 * Every source in the product, and the only place that decides which ones run.
 *
 * Google Places and Firmy.cz were removed in Vlna 2 on legal grounds, not technical ones:
 * Google Maps Platform ToS § 3.2.3(a) forbids storing business names and addresses outside
 * their services, and Firmy.cz robots.txt ends in a blanket `Disallow: /`. Neither may come
 * back without a written licence.
 */
export const DISCOVERY_SOURCES: DiscoverySource[] = [aresSource, osmSource];

export const ENRICHMENT_SOURCES: EnrichmentSource[] = [aresRzpSource, aresResSource, dphSource];

/**
 * Runs every discovery source and returns their leads grouped by source, in registration
 * order. A source that fails or times out contributes an empty list — the search goes on.
 */
export async function discoverAll(
  niche: string,
  city: string,
  limit: number,
  opts: { registry?: RegistryQuery; legalForms?: readonly string[] } = {},
): Promise<RawLead[][]> {
  return Promise.all(
    DISCOVERY_SOURCES.map(s => {
      // Filtr podle vzniku: místo dotazu do ARESu jde první zdroj přes index z ČSÚ, který
      // umí datum i celý kraj. OpenStreetMap běží dál stejně — kontakty index nemá.
      if (s.id === 'ares' && opts.registry && registryCanServe(opts.registry)) {
        return registryDiscover(opts.registry).catch(() => [] as RawLead[]);
      }
      return s.search(niche, city, limit, { legalForms: opts.legalForms }).catch(() => [] as RawLead[]);
    }),
  );
}
