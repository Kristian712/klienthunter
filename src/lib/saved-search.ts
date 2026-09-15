import { prisma } from './db';
import { firmKeyOf } from './claim-order';

/**
 * Uložená hledání a „co je nové od minule".
 *
 * Uložené hledání je běh se jménem (kořen). „Spustit znovu" založí další běh se `savedId`
 * ukazujícím na kořen. Nový řádek = firma, která v žádném dřívějším běhu téhož kořene nebyla.
 * To je tvrzení o registru, ne o čase: firma je nová v seznamu, protože ji zdroje minule
 * nevrátily — typicky vznikla nebo přibyla do OSM. Kdy uživatel kořen naposledy otevřel
 * (`lastOpenedAt`) říká, jestli ty nové už viděl.
 */

export interface SearchMeta {
  id: string;
  name: string | null;
  filters: string[];
  scenario: string | null;
  /** Kořen, ke kterému běh patří; u kořene je to on sám. */
  rootId: string;
  rootName: string | null;
  lastOpenedAt: Date | null;
  /** `profile` = výchozí kombinace z dotazníku, `user` = uživatelova vlastní. */
  origin: string | null;
  /** Kolik dřívějších běhů kořen má — bez nich nemá „nové" s čím srovnávat. */
  earlierRuns: number;
  /** Obor (`*` = všechny) a kraj, se kterými hledání běželo — formulář je po otevření převezme. */
  query: string;
  region: string;
}

/** Metadata běhu i jeho kořene. `null`, když hledání není uživatele. */
export async function searchMeta(searchId: string, userId: string): Promise<SearchMeta | null> {
  const s = await prisma.search.findFirst({
    where: { id: searchId, userId },
    select: {
      id: true, name: true, filters: true, scenario: true, savedId: true, lastOpenedAt: true, createdAt: true, origin: true,
      query: true, region: true,
      saved: { select: { id: true, name: true, filters: true, scenario: true, lastOpenedAt: true, origin: true, query: true, region: true } },
    },
  });
  if (!s) return null;
  const root = s.saved ?? s;
  const earlierRuns = await prisma.search.count({
    where: { userId, OR: [{ id: root.id }, { savedId: root.id }], createdAt: { lt: s.createdAt } },
  });
  return {
    id: s.id,
    name: s.name,
    // Kořen je jediný zdroj pravdy. Běh z „Spustit znovu" dostal při založení kopii filtrů, ale
    // ta zastará, jakmile si uživatel kořen upraví — a při otevření běhu by se vrátila.
    filters: root.filters,
    scenario: root.scenario,
    rootId: root.id,
    rootName: root.name,
    lastOpenedAt: root.lastOpenedAt,
    origin: root.origin,
    earlierRuns,
    query: root.query,
    region: root.region,
  };
}

/**
 * Označí řádky, které v dřívějších bězích téhož kořene nebyly (`isNew`), a řádky, u kterých
 * je poprvé kontakt (`contactNew`): firma už v seznamu byla, ale telefon ani e-mail u ní nikdy
 * nebyl — a teď je. Jeden dotaz na dřívější řádky, žádné N+1. Bez dřívějšího běhu nic „nové" není.
 */
export async function markNew<T extends { ico?: string | null; placeId: string; phone?: string | null; email?: string | null }>(
  meta: SearchMeta | null,
  userId: string,
  rows: T[],
): Promise<Array<T & { isNew: boolean; contactNew: boolean }>> {
  if (!meta || meta.earlierRuns === 0 || rows.length === 0) return rows.map(r => ({ ...r, isNew: false, contactNew: false }));
  const current = await prisma.search.findUnique({ where: { id: meta.id }, select: { createdAt: true } });
  const earlier = await prisma.businessResult.findMany({
    where: {
      search: { userId, OR: [{ id: meta.rootId }, { savedId: meta.rootId }], createdAt: { lt: current?.createdAt } },
    },
    select: { ico: true, placeId: true, phone: true, email: true },
  });
  const { seen, hadContact } = contactHistory(earlier);
  return rows.map(r => {
    const key = firmKeyOf(r);
    return { ...r, isNew: !seen.has(key), contactNew: seen.has(key) && !hadContact.has(key) && Boolean(r.phone || r.email) };
  });
}

/** Z dřívějších řádků: které firmy už v seznamu byly a které z nich měly kontakt. */
export function contactHistory(earlier: Array<{ ico?: string | null; placeId: string; phone?: string | null; email?: string | null }>) {
  const seen = new Set<string>();
  const hadContact = new Set<string>();
  for (const r of earlier) {
    const key = firmKeyOf(r);
    seen.add(key);
    if (r.phone || r.email) hadContact.add(key);
  }
  return { seen, hadContact };
}

/** Uživatel kořen otevřel — od teď se „nové" počítá znovu. */
export async function touchOpened(rootId: string, userId: string): Promise<void> {
  await prisma.search.updateMany({ where: { id: rootId, userId }, data: { lastOpenedAt: new Date() } });
}
