import { prisma } from '../db';
import { isAllIndustries, splitIndustries } from '../industries';
import { SOLE_TRADER_FORMS, indexConstraints } from '../lead-filters';
import { resolveNiche, USELESS_NACE } from '../nace-map';
import { activeOptoutKeys } from '../optout';
import { isWholeCz, nuts3ForRegion } from '../regions-nuts';
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
 *
 * Insolvence (etapa 6, rozhodnuto 14. 9. 2026): ISIR se nepoužívá jako zdroj seznamu a nikdy
 * se nesahá na fyzické osoby v oddlužení — to je hranice od majitele. Veřejná služba ISIR
 * (isir_public_ws) navíc vůbec nenese IČO, jen události řízení podle spisové značky, a služba
 * pro ČÚZK vrací i rodná čísla. Příznak „v insolvenčním rejstříku" proto bereme jedině z ARESu
 * (`seznamRegistraci.stavZdrojeIr`) u firem, které už z indexu vyšly — `inInsolvency` na řádku,
 * filtry `no_insolvency` / `in_insolvency` a srážka ve skóre. Nic víc ISIR nepřidá.
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
  /** Id filtrů; z nich se vezmou ty se `scope: 'index'` (právní forma, zaměstnanci, bez oboru). */
  filters?: readonly string[];
  /** Okresy (LAU 1, `CZ0724`) uvnitř kraje. Prázdné = celý kraj. */
  districts?: readonly string[];
}

/**
 * Podmínka nad indexem pro hledání i pro počty ve skládačce — jedno místo, aby obojí říkalo
 * totéž. Právní forma: živnostník = kódy 100/101, společnost = cokoli jiného. Zaměstnanci:
 * „má" = kategorie mimo 110 a neuvedeno, „bez" = jen výslovné 110 (neuvedeno nikdy).
 */
export function indexWhere(q: { nuts3: string | null; districts?: readonly string[]; windowDays: number; codes: string[]; all: boolean; filters: readonly string[] }) {
  const c = indexConstraints(q.filters);
  const since = new Date(Date.now() - q.windowDays * 24 * 60 * 60 * 1000);
  // `nuts3` null = celá ČR: index pokrývá celou republiku, tak se kraj neomezuje.
  const and: Record<string, unknown>[] = [
    ...(q.districts && q.districts.length ? [{ district: { in: [...q.districts] } }] : q.nuts3 ? [{ district: { startsWith: q.nuts3 } }] : []),
    { foundedAt: { gte: since } },
  ];
  if (!q.all && q.codes.length) and.push(naceWhere(q.codes));
  if (c.soleTrader) and.push({ legalForm: { in: SOLE_TRADER_FORMS } });
  if (c.company) and.push({ legalForm: { notIn: SOLE_TRADER_FORMS } });
  if (c.hasEmployees) and.push({ employeeCategory: { notIn: ['000', '110'], not: null } });
  if (c.noEmployees) and.push({ employeeCategory: '110' });
  if (c.noCategory) and.push({ OR: [{ nace: null }, { nace: '' }, { nace: '00' }] });
  if (c.olderThanYears) and.push({ foundedAt: { lte: new Date(Date.now() - c.olderThanYears * 365.25 * 86_400_000) } });
  return { AND: and };
}

/** Zda index pro tenhle dotaz vůbec může něco vrátit — jinak se hledá po staru přes ARES. */
export function registryCanServe(q: Pick<RegistryQuery, 'industry' | 'region'>): boolean {
  return (nuts3ForRegion(q.region) !== null || isWholeCz(q.region)) && (isAllIndustries(q.industry) || naceCodesFor(q.industry).length > 0);
}

/** NACE kódy všech oborů v dotazu (`a + b` = sjednocení). Pro „všechny obory" prázdné = bez filtru. */
export function naceCodesFor(industry: string): string[] {
  const codes = splitIndustries(industry).flatMap(part => {
    // Kód zadaný uživatelem se nefiltruje přes USELESS_NACE — vybral ho vědomě.
    if (/^nace:/i.test(part)) return resolveNiche(part).nace;
    return resolveNiche(part).nace.filter(c => !USELESS_NACE.has(c));
  });
  return Array.from(new Set(codes));
}

/**
 * RES ukládá převažující NACE v různé hloubce (2–5 znaků). Firma s `4941` má sedět na kód
 * `49410` a firma s `49410` na kód `4941`, takže se hledá oběma směry: prefix kódu i kratší
 * prefixy, které kód obsahuje.
 */
export function naceWhere(codes: string[]) {
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
  const all = isAllIndustries(q.industry);
  const codes = naceCodesFor(q.industry);
  if ((!nuts3 && !isWholeCz(q.region)) || (!all && codes.length === 0) || q.limit <= 0) return [];

  const rows = await prisma.registrySubject.findMany({
    // „Všechny obory": jen kraj a datum. Jediné místo v aplikaci, kde jde hledat bez oboru.
    where: indexWhere({ nuts3, districts: q.districts, windowDays: q.windowDays, codes, all, filters: q.filters ?? [] }),
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
      if (lead) leads.push({ ...lead, sourceId: 'res', matchedBy: 'nace' });
      const wait = MIN_GAP_MS * CONCURRENCY - (Date.now() - started);
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, icos.length) }, worker));

  // Pořadí z indexu (nejnovější první), ne pořadí, v jakém odpověděl ARES.
  const order = new Map(icos.map((ico, i) => [ico, i]));
  return leads.sort((a, b) => (order.get(a.ico!) ?? 0) - (order.get(b.ico!) ?? 0));
}
