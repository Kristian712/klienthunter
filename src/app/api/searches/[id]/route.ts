import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
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
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);

    // Scoped by userId on purpose: a stranger's id must look missing, not forbidden.
    const search = await prisma.search.findFirst({
      where: { id: params.id, userId: payload.userId },
      select: { id: true },
    });
    if (!search) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.search.delete({ where: { id: search.id } });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
