import { NextRequest, NextResponse } from 'next/server';
import { sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sweepStaleJobs } from '@/lib/search-job';

/**
 * Seznam hledání uživatele — aby se dalo vrátit ke staršímu běhu.
 *
 * Než se seznam sestaví, uklidí se joby, které se dlouho neposunuly. Dělá se to tady a ne
 * cronem schválně: na Hobby plánu je frekvence cronů omezená a nikde jinde ten úklid není
 * potřeba dřív, než se na seznam někdo podívá.
 */
export async function GET(req: NextRequest) {
  const session = sessionFrom(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await sweepStaleJobs(session.userId);

  const jobs = await prisma.searchJob.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: {
      id: true, searchId: true, status: true, region: true, industry: true,
      foundCount: true, processedCount: true, startedAt: true, finishedAt: true,
      error: true, createdAt: true,
    },
  });

  return NextResponse.json({ jobs });
}
