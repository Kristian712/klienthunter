import { NextRequest, NextResponse } from 'next/server';
import { sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { startSearch } from '@/lib/start-search';

export const maxDuration = 300;

/**
 * „Spustit znovu": nový běh uloženého hledání se stejným oborem, krajem, filtry a scénářem.
 * Běh dostane `savedId` = kořen, takže se v něm dá spočítat, co je nové od minule. Počítá se
 * do limitů tarifu jako každé jiné hledání — je to skutečný dotaz do rejstříků.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = sessionFrom(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const search = await prisma.search.findFirst({
      where: { id: params.id, userId: payload.userId },
      select: { id: true, query: true, region: true, savedId: true, filters: true, scenario: true, saved: { select: { id: true, filters: true, scenario: true } } },
    });
    if (!search) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // Import CSV nemá co spouštět znovu — řádky přinesl uživatel, ne rejstřík.
    if (search.query === 'CSV import') return NextResponse.json({ error: 'Cannot rerun an import', code: 'IMPORT' }, { status: 422 });

    const root = search.saved ?? search;
    const started = await startSearch({
      userId: payload.userId,
      industry: search.query,
      region: search.region,
      savedId: root.id,
      filters: root.filters,
      scenario: root.scenario,
    });
    if (!started.ok) {
      const message = started.code === 'PLAN_LIMIT' ? 'Search limit reached for your plan'
        : started.code === 'RATE_LIMITED' ? 'Too many searches in a short time' : 'Unauthorized';
      return NextResponse.json({ error: message, code: started.code }, { status: started.status });
    }
    return NextResponse.json({ jobId: started.jobId, searchId: started.searchId });
  } catch (err) {
    console.error('/api/searches/[id]/rerun:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
