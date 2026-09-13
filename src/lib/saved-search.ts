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
  /** Kolik dřívějších běhů kořen má — bez nich nemá „nové" s čím srovnávat. */
  earlierRuns: number;
}

/** Metadata běhu i jeho kořene. `null`, když hledání není uživatele. */
export async function searchMeta(searchId: string, userId: string): Promise<SearchMeta | null> {
  const s = await prisma.search.findFirst({
    where: { id: searchId, userId },
    select: {
      id: true, name: true, filters: true, scenario: true, savedId: true, lastOpenedAt: true, createdAt: true,
      saved: { select: { id: true, name: true, filters: true, scenario: true, lastOpenedAt: true } },
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
    filters: s.filters.length ? s.filters : root.filters,
    scenario: s.scenario ?? root.scenario,
    rootId: root.id,
    rootName: root.name,
    lastOpenedAt: root.lastOpenedAt,
    earlierRuns,
  };
}

/**
 * Označí řádky, které v dřívějších bězích téhož kořene nebyly. Jeden dotaz na klíče
 * dřívějších řádků (IČO / placeId), žádné N+1. Bez dřívějšího běhu nic „nové" není.
 */
export async function markNew<T extends { ico?: string | null; placeId: string }>(
  meta: SearchMeta | null,
  userId: string,
  rows: T[],
): Promise<Array<T & { isNew: boolean }>> {
  if (!meta || meta.earlierRuns === 0 || rows.length === 0) return rows.map(r => ({ ...r, isNew: false }));
  const current = await prisma.search.findUnique({ where: { id: meta.id }, select: { createdAt: true } });
  const earlier = await prisma.businessResult.findMany({
    where: {
      search: { userId, OR: [{ id: meta.rootId }, { savedId: meta.rootId }], createdAt: { lt: current?.createdAt } },
    },
    select: { ico: true, placeId: true },
  });
  const seen = new Set(earlier.map(firmKeyOf));
  return rows.map(r => ({ ...r, isNew: !seen.has(firmKeyOf(r)) }));
}

/** Uživatel kořen otevřel — od teď se „nové" počítá znovu. */
export async function touchOpened(rootId: string, userId: string): Promise<void> {
  await prisma.search.updateMany({ where: { id: rootId, userId }, data: { lastOpenedAt: new Date() } });
}
