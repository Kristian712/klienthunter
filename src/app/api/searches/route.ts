import { NextRequest, NextResponse } from 'next/server';
import { sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { firmKeyOf } from '@/lib/claim-order';

/**
 * Odpověď závisí na cookie, takže staticky se vykreslit nedá. Bez tohohle to Next zkusí při
 * buildu, dostane `Dynamic server usage` — a od chvíle, kdy `catch` chyby loguje, to při
 * každém buildu vypadá jako pád. Za běhu se nemění nic, jen se přestane zkoušet nemožné.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const payload = sessionFrom(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const searches = await prisma.search.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { results: true } } },
    });

    /**
     * Uložená hledání = kořeny se jménem. Ke každému poslední běh a kolik řádků v něm je nových
     * od posledního otevření: řádky posledního běhu vzniklé po `lastOpenedAt`, jejichž firma
     * v dřívějších bězích nebyla. Jeden dotaz na kořen; kořenů je pár desítek nejvýš.
     */
    const roots = searches.filter(s => s.name);
    const saved = await Promise.all(roots.map(async root => {
      const runs = searches.filter(s => s.id === root.id || s.savedId === root.id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const latest = runs[0];
      let newCount = 0;
      if (runs.length > 1) {
        const earlier = await prisma.businessResult.findMany({
          where: { searchId: { in: runs.slice(1).map(r => r.id) } },
          select: { ico: true, placeId: true },
        });
        const seen = new Set(earlier.map(firmKeyOf));
        const current = await prisma.businessResult.findMany({
          where: { searchId: latest.id, ...(root.lastOpenedAt ? { createdAt: { gt: root.lastOpenedAt } } : {}) },
          select: { ico: true, placeId: true },
        });
        newCount = current.filter(r => !seen.has(firmKeyOf(r))).length;
      }
      return {
        id: root.id, name: root.name, query: root.query, region: root.region,
        filters: root.filters, scenario: root.scenario, lastOpenedAt: root.lastOpenedAt,
        runs: runs.length, latestId: latest.id, latestAt: latest.createdAt, latestCount: latest._count.results,
        newCount,
      };
    }));

    return NextResponse.json({ searches, saved });
  } catch (err) {
    console.error('/api/searches:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
