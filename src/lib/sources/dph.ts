import axios from 'axios';
import type { EnrichmentSource, RawLead } from './types';

const ENDPOINT = 'https://adisrws.mfcr.cz/dpr/axis2/services/rozhraniCRPDPH.rozhraniCRPDPHSOAP';

/**
 * The tax office answers one question at a time and only if you already know the DIČ, so this
 * is enrichment, never discovery.
 *
 * Two things come back. `nespolehlivyPlatce="ANO"` is a real warning — the state is publicly
 * saying this firm does not pay what it owes. Registration itself is a much weaker signal than
 * it looks: it is mandatory above a turnover threshold, but plenty of one-person businesses
 * register voluntarily to reclaim input VAT, so it must not be sold as a measure of size.
 */
function soapEnvelope(dic: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:r="http://adis.mfcr.cz/rozhraniCRPDPH/">
  <soapenv:Body>
    <r:StatusNespolehlivyPlatceRequest>
      <r:dic>${dic}</r:dic>
    </r:StatusNespolehlivyPlatceRequest>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/** DIČ is the IČO with a country prefix; the service wants it without. */
function toDic(lead: RawLead): string | null {
  const raw = lead.dic ?? lead.ico;
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

export const dphSource: EnrichmentSource = {
  id: 'dph',
  label: 'Registr plátců DPH',

  async enrich(lead: RawLead): Promise<Partial<RawLead>> {
    const dic = toDic(lead);
    if (!dic) return {};

    try {
      const res = await axios.post(ENDPOINT, soapEnvelope(dic), {
        timeout: 8_000,
        signal: AbortSignal.timeout(8_000),
        headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' },
        validateStatus: () => true,
      });
      if (res.status !== 200 || typeof res.data !== 'string') return {};

      const match = res.data.match(/nespolehlivyPlatce="([^"]+)"/);
      if (!match) return {};

      // NENALEZEN means "not in the VAT register" — absence of a record, not a bad record.
      if (match[1] === 'NENALEZEN') return { vatPayer: false, vatUnreliable: false };
      return { vatPayer: true, vatUnreliable: match[1] === 'ANO' };
    } catch {
      return {};
    }
  },
};
