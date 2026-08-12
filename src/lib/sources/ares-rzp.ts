import axios from 'axios';
import type { EnrichmentSource, RawLead } from './types';

const BASE = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest';

/**
 * The trade-licence register cannot be searched by trade or place — its `/vyhledat` accepts
 * only `ico` — so it is strictly an enrichment step. What it adds is worth the request:
 * `provozovny`, the addresses of the premises the business actually operates from, as opposed
 * to the registered seat, which for a sole trader is usually their flat.
 */
interface RzpEstablishment {
  sidloProvozovny?: { textovaAdresa?: string; nazevObce?: string };
}

interface RzpTrade {
  provozovny?: RzpEstablishment[];
  predmetPodnikani?: unknown;
}

function establishments(trades: RzpTrade[]): RzpEstablishment[] {
  return trades.flatMap(t => t.provozovny ?? []);
}

export const aresRzpSource: EnrichmentSource = {
  id: 'ares-rzp',
  label: 'ARES – živnostenský rejstřík',

  async enrich(lead: RawLead): Promise<Partial<RawLead>> {
    if (!lead.ico) return {};

    try {
      const res = await axios.get(`${BASE}/ekonomicke-subjekty-rzp/${lead.ico}`, {
        timeout: 8_000,
        signal: AbortSignal.timeout(8_000),
        validateStatus: () => true,
      });
      if (res.status !== 200) return {};

      const trades: RzpTrade[] = res.data?.zaznamy?.[0]?.zivnosti ?? [];
      const premises = establishments(trades);
      if (premises.length === 0) return {};

      // Prefer a real shop or workshop address over the registered seat.
      const address = premises[0].sidloProvozovny?.textovaAdresa;
      return address ? { address } : {};
    } catch {
      return {};
    }
  },
};
