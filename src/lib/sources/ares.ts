import axios from 'axios';
import { resolveNiche, USELESS_NACE } from '../nace-map';
import { subAreasFor } from './ares-areas';
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
  sidlo?: { textovaAdresa?: string; kodAdresnihoMista?: number; kodObce?: number };
  /** `YYYY-MM-DD`, already in the search response — no detail request needed. */
  datumVzniku?: string;
  /** Kód právní formy. Stejný číselník, jakým se dá i filtrovat (viz `SPLIT_FORMS`). */
  pravniForma?: string;
  /**
   * Stav subjektu v jednotlivých rejstřících. Zajímá nás `stavZdrojeDph`: registr plátců DPH
   * se dnes obchází zvlášť SOAPem na ADIS, ale ten stíhá jen část firem — kdežto tohle přijde
   * v odpovědi, kterou stahujeme tak jako tak.
   */
  seznamRegistraci?: { stavZdrojeDph?: string };
}

interface AresFilter {
  start?: number;
  pocet?: number;
  czNace?: string[];
  obchodniJmeno?: string;
  pravniForma?: string[];
  sidlo?: {
    textovaAdresa?: string;
    kodAdresnihoMista?: number;
    kodObce?: number;
    /** Kód městské části nebo obvodu (MOMC v RÚIAN). Viz `ares-areas.ts`. */
    kodMestskeCastiObvodu?: number;
  };
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
    // Souřadnice ARES nevrací, ale tenhle kód je klíč k nim. Viz `RawLead.ruianCode`.
    ruianCode: s.sidlo?.kodAdresnihoMista,
    obecCode: s.sidlo?.kodObce,
    category: nace[0],
    foundedAt: parseAresDate(s.datumVzniku),
    legalForm: s.pravniForma,
    // Jen když ARES řekne „AKTIVNI". „NEEXISTUJICI" znamená, že subjekt v registru plátců není,
    // tedy plátce není — a to je odpověď, ne mezera. Cokoli jiného (ZANIKLY…) necháváme
    // nevyplněné a ať to případně doplní dotaz na ADIS, který umí i nespolehlivého plátce.
    vatPayer: s.seznamRegistraci?.stavZdrojeDph === 'AKTIVNI'
      ? true
      : s.seznamRegistraci?.stavZdrojeDph === 'NEEXISTUJICI'
        ? false
        : undefined,
  };
}

/**
 * Vytáhne z ARESu jeden filtr, a když ho ARES odmítne pro velikost, zkusí ho postupně zúžit.
 *
 * Tři úrovně, každá užší než předchozí:
 *   1. filtr, jak přišel,
 *   2. rozpad podle právní formy (`SPLIT_FORMS`),
 *   3. rozpad podle městských částí (`subAreas`), a uvnitř každé části zase podle formy.
 *
 * Třetí úroveň je tu proto, že u velkých měst druhá nestačí: v Praze je samotných živnostníků
 * s NACE 96210 přes osmdesát tisíc, takže rozpad podle formy skončí zase odmítnutím a hledání
 * do teď vracelo prázdno — mlčky, jako by v Praze žádná kadeřnictví nebyla.
 *
 * Když ani třetí úroveň nestačí (jedna městská část přes tisíc firem), vrátí se, co se stihlo
 * jinde. Vždycky je to víc než nula, kterou tenhle kód vracel předtím.
 */
async function collect(
  base: AresFilter,
  limit: number,
  until: number,
  subAreas: number[] = [],
): Promise<AresSubject[]> {
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

  let stillTooMany = false;
  for (const forms of SPLIT_FORMS) {
    if (out.length >= limit || Date.now() >= until) break;
    const split = await drain({ ...base, pravniForma: forms });
    if (split.tooMany) stillTooMany = true;
  }

  // Rozpad podle formy stačil, nebo aspoň něco přinesl a čas došel. Dál se nezkouší.
  if (!stillTooMany || subAreas.length === 0) return out;

  /**
   * Poslední úroveň. Části, ve kterých už něco máme, se neopakují — a protože se `out` sdílí,
   * limit i hodiny hlídá `drain` sám. Sídlo se přepisuje celé: `kodMestskeCastiObvodu` a
   * `textovaAdresa` vedle sebe by znamenaly „část X, jejíž adresa obsahuje jméno celého města",
   * což je zbytečně užší podmínka.
   */
  for (const area of subAreas) {
    if (out.length >= limit || Date.now() >= until) break;
    const areaFilter: AresFilter = { ...base, sidlo: { kodMestskeCastiObvodu: area } };
    const area1 = await drain(areaFilter);
    if (!area1.tooMany) continue;
    for (const forms of SPLIT_FORMS) {
      if (out.length >= limit || Date.now() >= until) break;
      await drain({ ...areaFilter, pravniForma: forms });
    }
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
    // Kam se dá ustoupit, když ARES řekne, že by výsledek byl přes tisíc řádků. U menších měst
    // je to prázdné pole — tam se to nestává.
    const subAreas = city ? subAreasFor(city) : [];

    const strands: Promise<AresSubject[]>[] = [];
    if (nace.length) strands.push(collect({ czNace: nace, sidlo }, limit, until, subAreas));
    for (const kw of keywords.slice(0, 2)) {
      strands.push(collect({ obchodniJmeno: kw, sidlo }, Math.ceil(limit / 2), until, subAreas));
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
