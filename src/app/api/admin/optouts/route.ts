import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { activeAccount, sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Seznam žádostí o vyřazení. Jen pro kontrolu — vyřazení platí bez ohledu na tenhle seznam. */
export async function GET(req: NextRequest) {
  const payload = sessionFrom(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = await activeAccount(payload.userId);
  if (!me?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const optouts = await prisma.optout.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { id: true, firmKey: true, email: true, status: true, note: true, createdAt: true, confirmedAt: true, reviewedAt: true },
  });
  return NextResponse.json({ optouts });
}

const Body = z.object({
  id: z.string().min(1),
  /** `rejected` vrátí subjekt do výsledků; `active` ho znovu vyřadí. */
  status: z.enum(['active', 'rejected']),
  note: z.string().trim().max(300).optional(),
});

export async function PATCH(req: NextRequest) {
  const payload = sessionFrom(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = await activeAccount(payload.userId);
  if (!me?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id, status, note } = Body.parse(await req.json());
    const row = await prisma.optout.update({
      where: { id },
      data: { status, note, reviewedAt: new Date() },
      select: { id: true, status: true, note: true, reviewedAt: true },
    });
    return NextResponse.json({ optout: row });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 422 });
    console.error('/api/admin/optouts:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
