import { NextRequest, NextResponse } from 'next/server';
import { sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Deletes a search together with its results.
 *
 * The user is the only person who can throw these rows away, and GDPR says they must be able
 * to: a CSV import in particular is their own contact list sitting in our database. The
 * relations cascade (`BusinessResult.search` and `SavedResult.businessResult` in
 * `prisma/schema.prisma`), so one delete takes the whole tree with it.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = sessionFrom(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Scoped by userId on purpose: a stranger's id must look missing, not forbidden.
    const search = await prisma.search.findFirst({
      where: { id: params.id, userId: payload.userId },
      select: { id: true },
    });
    if (!search) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.search.delete({ where: { id: search.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('/api/searches/[id]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
