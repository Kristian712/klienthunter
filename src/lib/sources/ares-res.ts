import axios from 'axios';
import type { EnrichmentSource, RawLead } from './types';

const BASE = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest';

/**
 * Statistický registr (RES) v ARESu — jediné místo, kde je kategorie počtu pracovníků.
 *
 * Stejný server a stejný limit jako ostatní volání ARESu (500 dotazů za minutu), jeden dotaz na
 * firmu navíc, jen u firem s IČO. Odpověď nese `statistickeUdaje.kategoriePoctuPracovniku` jako
 * kód číselníku ČSÚ: `110` bez zaměstnanců, `120` = 1–5, `130` = 6–9, `210` = 10–19 … a `000`
 * = neuvedeno.
 *
 * Vyplněnost je slabá a musí se to říkat nahlas: v celém registru má hodnotu 49 % subjektů,
 * u živnostníků ze vzorku jen asi 40 % (měřeno 13. 9. 2026 nad dumpem ČSÚ a 12 náhodnými
 * firmami). „Neuvedeno" je proto třetí stav — nikdy se nesmí přečíst jako „bez zaměstnanců".
 */
interface ResRecord {
  statistickeUdaje?: { kategoriePoctuPracovniku?: string };
  czNacePrevazujici?: string;
}

export const aresResSource: EnrichmentSource = {
  id: 'ares-res',
  label: 'ARES – statistický registr',

  async enrich(lead: RawLead): Promise<Partial<RawLead>> {
    if (!lead.ico) return {};
    try {
      const res = await axios.get(`${BASE}/ekonomicke-subjekty-res/${lead.ico}`, {
        timeout: 8_000,
        signal: AbortSignal.timeout(8_000),
        validateStatus: () => true,
      });
      if (res.status !== 200) return {};
      const zaznam: ResRecord | undefined = res.data?.zaznamy?.[0];
      const category = zaznam?.statistickeUdaje?.kategoriePoctuPracovniku;
      // `000` ukládáme taky: říká „registr to nemá", což je jiná informace než „neptali jsme se".
      return category ? { employeeCategory: category } : {};
    } catch {
      return {};
    }
  },
};
