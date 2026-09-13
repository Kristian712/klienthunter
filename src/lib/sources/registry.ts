import { prisma } from '../db';
import { resolveNiche, USELESS_NACE } from '../nace-map';
import { activeOptoutKeys } from '../optout';
import { nuts3ForRegion } from '../regions-nuts';
import { fetchSubject } from './ares';
import type { RawLead } from './types';

/**
 * Hledání přes index z ČSÚ (lib/registry-index.ts) místo dotazu do ARESu.
 *
 * ARES neumí filtrovat podle data vzniku, takže „firmy vzniklé za 30 dní" z něj nejdou dostat.
 * Index to umí, ale zná jen IČO a registrová pole — jméno, sídlo a DIČ se dohledají v ARESu
 * jednotlivě (`fetchSubject`), jen u firem, které projdou filtrem. Proto se tenhle zdroj
 * pouští jen tehdy, když je zapnutý filtr podle vzniku; jinak by u každého hledání stálo
 * pět set dotazů navíc za nic.
 *
 * Co index dává navíc oproti ARESu: opravdu celý kraj (okres = LAU 1, kraj = prvních pět
 * znaků), ne jen krajské město. Co nedává: firmy bez NACE se podle názvu nenajdou, protože
 * index žádná jména nemá — a mít nemá.
 */

/** ARES má limit 500 dotazů za minutu; osm souběžných po 130 ms dává asi 460. */
const CONCURRENCY = 8;
const MIN_GAP_MS = 130;

export interface RegistryQuery {
  industry: string;
  /** Hodnota regionu z nabídky („Zlín, Zlínský kraj"). Kraj se z ní čte podle `regions-nuts`. */
  region: string;
  /** Jak staré firmy chceme: dny od vzniku. Přijde z filtrů (`registryWindowDays`). */
  windowDays: number;
  limit: number;
}

/** Zda index pro tenhle dotaz vůbec může něco vrátit — jinak se hledá po staru přes ARES. */
export function registryCanServe(q: Pick<RegistryQuery, 'industry' | 'region'>): boolean {
  return nuts3ForRegion(q.region) !== null && naceCodesFor(q.industry).length > 0;
}

function naceCodesFor(industry: string): string[] {
  return resolveNiche(industry).nace.filter(c => !USELESS_NACE.has(c));
}

/**
 * RES ukládá převažující NACE v různé hloubce (2–5 znaků). Firma s `4941` má sedět na kód
 * `49410` a firma s `49410` na kód `4941`, takže se hledá oběma směry: prefix kódu i kratší
 * prefixy, které kód obsahuje.
 */
function naceWhere(codes: string[]) {
  const shorter = new Set<string>();
  for (const code of codes) for (let len = 2; len < code.length; len++) shorter.add(code.slice(0, len));
  return {
    OR: [
      ...codes.map(code => ({ nace: { startsWith: code } })),
      ...(shorter.size ? [{ nace: { in: Array.from(shorter) } }] : []),
    ],
  };
}

export async function registryDiscover(q: RegistryQuery): Promise<RawLead[]> {
  const nuts3 = nuts3ForRegion(q.region);
  const codes = naceCodesFor(q.industry);
  if (!nuts3 || codes.length === 0 || q.limit <= 0) return [];

  const since = new Date(Date.now() - q.windowDays * 24 * 60 * 60 * 1000);
  const rows = await prisma.registrySubject.findMany({
    where: { district: { startsWith: nuts3 }, foundedAt: { gte: since }, ...naceWhere(codes) },
    // Nejnovější první: kdo hledá nové firmy, chce být u nich první.
    orderBy: { foundedAt: 'desc' },
    select: { ico: true },
    // Rezerva na vyřazené a na subjekty, které ARES mezitím nezná.
    take: Math.ceil(q.limit * 1.2),
  });
  if (rows.length === 0) return [];

  // Vyřazení na žádost platí i tady — vyřazený subjekt se do ARESu vůbec neposílá.
  const blocked = await activeOptoutKeys(rows.map(r => r.ico));
  const icos = rows.map(r => r.ico).filter(ico => !blocked.has(ico)).slice(0, q.limit);

  const leads: RawLead[] = [];
  let next = 0;
  const worker = async () => {
    while (next < icos.length) {
      const ico = icos[next++];
      const started = Date.now();
      const lead = await fetchSubject(ico);
      if (lead) leads.push({ ...lead, sourceId: 'res' });
      const wait = MIN_GAP_MS * CONCURRENCY - (Date.now() - started);
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, icos.length) }, worker));

  // Pořadí z indexu (nejnovější první), ne pořadí, v jakém odpověděl ARES.
  const order = new Map(icos.map((ico, i) => [ico, i]));
  return leads.sort((a, b) => (order.get(a.ico!) ?? 0) - (order.get(b.ico!) ?? 0));
}
