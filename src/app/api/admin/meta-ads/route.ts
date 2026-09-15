import { NextRequest, NextResponse } from 'next/server';
import { activeAccount, sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { metaAdsEnabled } from '@/lib/sources/meta-ads';

export const dynamic = 'force-dynamic';

/** Stav zdroje Meta Knihovna reklam pro admin: token, kolik měst je v cache a kdy naposledy. */
export async function GET(req: NextRequest) {
  const payload = sessionFrom(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = await activeAccount(payload.userId);
  if (!me?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const [advertisers, queries, last] = await Promise.all([
      prisma.metaAdvertiser.count(),
      prisma.metaAdvertiser.groupBy({ by: ['query'] }),
      prisma.metaAdvertiser.findFirst({ orderBy: { fetchedAt: 'desc' }, select: { fetchedAt: true } }),
    ]);
    return NextResponse.json({ enabled: metaAdsEnabled(), advertisers, queries: queries.length, lastFetchedAt: last?.fetchedAt ?? null });
  } catch (err) {
    console.error('/api/admin/meta-ads:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
