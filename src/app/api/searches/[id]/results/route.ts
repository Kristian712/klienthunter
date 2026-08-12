import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { cityOf, resolveFilters } from '@/lib/lead-filters';

/**
 * Reads back the rows of one search.
 *
 * `?filter=` takes a comma-separated list of filter ids from `src/lib/lead-filters.ts` and
 * combines them with AND — the route itself knows nothing about what any of them mean, so a
 * new filter never touches this file. Unknown ids are ignored rather than rejected.
 *
 * `?city=` is a facet, not a filter: the value comes from the data we already returned, so it
 * is matched here rather than declared in the registry.
 */
const MAX_TAKE = 500;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    const search = await prisma.search.findFirst({
      where: { id: params.id, userId: payload.userId },
    });

    if (!search) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const ids = (searchParams.get('filter') ?? '').split(',').map(s => s.trim()).filter(Boolean);
    const active = resolveFilters(ids);
    const category = searchParams.get('category')?.trim();
    const city = searchParams.get('city')?.trim();
    const sort = searchParams.get('sort');

    const where: Record<string, unknown> = { searchId: params.id };
    if (active.length) where.AND = active.map(f => f.where);
    if (category) where.category = category;

    const take = Math.min(Number(searchParams.get('take')) || MAX_TAKE, MAX_TAKE);
    const skip = Math.max(Number(searchParams.get('skip')) || 0, 0);

    const rows = await prisma.businessResult.findMany({
      where,
      orderBy: sort === 'name' ? { name: 'asc' } : [{ leadScore: 'desc' }, { name: 'asc' }],
      // The town is derived from a free-text address, so it cannot be a SQL predicate. Filtering
      // after the query is fine because a single search is capped at a few hundred rows.
      take: city ? undefined : take,
      skip: city ? undefined : skip,
    });

    const results = city ? rows.filter(r => cityOf(r.address) === city).slice(skip, skip + take) : rows;
    return NextResponse.json({ results, total: results.length });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
