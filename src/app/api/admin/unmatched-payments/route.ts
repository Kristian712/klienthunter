import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { activeAccount, sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Zaplacené, ale nespárované platby ze Stripe (viz webhook: zákazník bez účtu u nás).
 *
 * Webhook je zapisoval od začátku, ale admin je nikde neviděl — a jsou to peníze, které
 * někdo poslal a nic za ně nedostal. Seznam je jen ke čtení plus „vyřešeno" ručně: spárování
 * účtu nebo vrácení peněz se dělá ve Stripe, tady se jen odškrtne, že se stalo.
 */
export async function GET(req: NextRequest) {
  const payload = sessionFrom(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = await activeAccount(payload.userId);
  if (!me?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const payments = await prisma.unmatchedPayment.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ payments });
}

const Body = z.object({ id: z.string().min(1) });

export async function PATCH(req: NextRequest) {
  const payload = sessionFrom(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = await activeAccount(payload.userId);
  if (!me?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id } = Body.parse(await req.json());
    const row = await prisma.unmatchedPayment.update({
      where: { id },
      data: { resolvedAt: new Date() },
      select: { id: true, resolvedAt: true },
    });
    return NextResponse.json({ payment: row });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 422 });
    console.error('/api/admin/unmatched-payments:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
