import axios from 'axios';
import { resolveNiche, USELESS_NACE } from '../nace-map';
import type { DiscoverySource, RawLead } from './types';

const BASE = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest';
const PAGE = 100;

/**
 * Paging is sequential, and a 500-lead plan split three ways by legal form is fifteen round
 * trips. The caller only has sixty seconds in total, so discovery stops on the clock and
 * returns what it has rather than paging into a gateway timeout.
 */
const SEARCH_BUDGET_MS = 20_000;

/**
 * ARES refuses a query outright — HTTP 400, zero rows — when the *total* would exceed 1000.
 * It does not truncate. So "electricians in Prague" returns nothing unless we narrow first,
 * and the only cheap narrowing axis is legal form. These three cover almost every real
 * business; the rest are foundations, co-ops and state bodies nobody is selling websites to.
 */
const SPLIT_FORMS = [
  ['112'],               // s.r.o.
  ['100', '101'],        // sole traders
  ['121', '111', '113'], // a.s. and the other trading forms
];

interface AresSubject {
  ico?: string;
  dic?: string;
  obchodniJmeno?: string;
  czNace?: string[];
  sidlo?: { textovaAdresa?: string };
  /** `YYYY-MM-DD`, already in the search response — no detail request needed. */
  datumVzniku?: string;
}

interface AresFilter {
  start?: number;
  pocet?: number;
  czNace?: string[];
  obchodniJmeno?: string;
  pravniForma?: string[];
  sidlo?: { textovaAdresa?: string };
}

interface AresPage {
  subjects: AresSubject[];
  /** True when ARES rejected the query because the result set was over its 1000 cap. */
  tooMany: boolean;
}

async function fetchPage(filter: AresFilter): Promise<AresPage> {
  try {
    const res = await axios.post(`${BASE}/ekonomicke-subjekty/vyhledat`, filter, {
      timeout: 12_000,
      signal: AbortSignal.timeout(12_000),
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
    });

    if (res.status === 400) {
      return { subjects: [], tooMany: res.data?.subKod === 'VYSTUP_PRILIS_MNOHO_VYSLEDKU' };
    }
    if (res.status !== 200) return { subjects: [], tooMany: false };

    return { subjects: res.data?.ekonomickeSubjekty ?? [], tooMany: false };
  } catch {
    return { subjects: [], tooMany: false };
  }
}

/** ARES dates are plain `YYYY-MM-DD`; anything else is treated as absent rather than as 1970. */
function parseAresDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toLead(s: AresSubject): RawLead | null {
  if (!s.ico || !s.obchodniJmeno) return null;
  const nace = (s.czNace ?? []).filter(c => c.length >= 4 && !USELESS_NACE.has(c));
  return {
    sourceId: 'ares',
    externalId: `ares:${s.ico}`,
    name: s.obchodniJmeno,
    ico: s.ico,
    dic: s.dic,
    address: s.sidlo?.textovaAdresa,
    category: nace[0],
    foundedAt: parseAresDate(s.datumVzniku),
  };
}

/** Pages through one filter until `limit` is reached, splitting by legal form if ARES balks. */
async function collect(base: AresFilter, limit: number, until: number): Promise<AresSubject[]> {
  const out: AresSubject[] = [];

  const drain = async (filter: AresFilter) => {
    for (let start = 0; out.length < limit; start += PAGE) {
      if (Date.now() >= until) return { tooMany: false };
      const page = await fetchPage({ ...filter, start, pocet: Math.min(PAGE, limit - out.length) });
      if (page.tooMany) return { tooMany: true };
      if (page.subjects.length === 0) break;
      out.push(...page.subjects);
      if (page.subjects.length < PAGE) break;
    }
    return { tooMany: false };
  };

  const first = await drain(base);
  if (!first.tooMany) return out;

  for (const forms of SPLIT_FORMS) {
    if (out.length >= limit || Date.now() >= until) break;
    await drain({ ...base, pravniForma: forms });
  }
  return out;
}

/**
 * ARES gives volume and legal certainty but no contacts whatsoever. It is the backbone of a
 * search; phones, e-mails and websites have to come from OSM or the firm's own site.
 *
 * Two independent strands are run because neither is sufficient alone: NACE misses every firm
 * that declared no activity code, and the name search misses every firm not named after its
 * trade ("Novák a syn" is an electrician you will only find by NACE).
 */
export const aresSource: DiscoverySource = {
  id: 'ares',
  label: 'ARES (veřejný registr)',

  async search(niche: string, city: string, limit: number): Promise<RawLead[]> {
    const { nace, keywords } = resolveNiche(niche);
    const sidlo = city ? { textovaAdresa: city } : undefined;
    const until = Date.now() + SEARCH_BUDGET_MS;

    const strands: Promise<AresSubject[]>[] = [];
    if (nace.length) strands.push(collect({ czNace: nace, sidlo }, limit, until));
    for (const kw of keywords.slice(0, 2)) {
      strands.push(collect({ obchodniJmeno: kw, sidlo }, Math.ceil(limit / 2), until));
    }

    const batches = await Promise.all(strands);

    const seen = new Set<string>();
    const leads: RawLead[] = [];
    for (const batch of batches) {
      for (const subject of batch) {
        const lead = toLead(subject);
        if (!lead || seen.has(lead.ico!)) continue;
        seen.add(lead.ico!);
        leads.push(lead);
        if (leads.length >= limit) return leads;
      }
    }
    return leads;
  },
};
