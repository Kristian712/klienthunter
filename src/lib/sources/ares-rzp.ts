import axios from 'axios';
import type { EnrichmentSource, RawLead } from './types';
import { cachedRzp, patchFromRzp, rememberRzp, type RzpZaznam } from './rzp-bulk';

const BASE = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest';

/**
 * The trade-licence register cannot be searched by trade or place — its `/vyhledat` accepts
 * only `ico` — so it is strictly an enrichment step. What it adds is worth the request:
 * `provozovny`, the addresses of the premises the business actually operates from, as opposed
 * to the registered seat, which for a sole trader is usually their flat.
 */
export const aresRzpSource: EnrichmentSource = {
  id: 'ares-rzp',
  label: 'ARES – živnostenský rejstřík',

  async enrich(lead: RawLead): Promise<Partial<RawLead>> {
    if (!lead.ico) return {};
    // Hromadná kontrola živností při hledání (rzp-bulk.ts) už záznam stáhla — bez dalšího dotazu.
    const cached = cachedRzp(lead.ico);
    if (cached !== undefined) return patchFromRzp(cached);

    try {
      const res = await axios.get(`${BASE}/ekonomicke-subjekty-rzp/${lead.ico}`, {
        timeout: 8_000,
        signal: AbortSignal.timeout(8_000),
        validateStatus: () => true,
      });
      if (res.status !== 200) return {};
      const zaznam: RzpZaznam | null = res.data?.zaznamy?.[0] ?? null;
      rememberRzp(lead.ico, zaznam);
      // Živnosti se do 13. 9. 2026 četly a zahazovaly; „nová živnost" je přitom událost,
      // na kterou čeká účetní i pojišťovák. Firma bez provozovny má počítadlo 0, ne „nevíme".
      return zaznam ? patchFromRzp(zaznam) : {};
    } catch {
      return {};
    }
  },
};
