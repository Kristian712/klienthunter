import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { LEAD_STATUS_IDS } from '@/lib/lead-tags';

const Body = z.object({
  status: z.enum(LEAD_STATUS_IDS as [string, ...string[]]),
  note: z.string().trim().max(500).optional(),
});

/**
 * Nastaví, kde je uživatel s danou firmou.
 *
 * Značka patří dvojici uživatel + firma, takže `upsert` na složeném unikátním klíči: druhé
 * kliknutí stav přepíše, nezaloží druhý řádek.
 *
 * Ověřuje se, že firma pochází z hledání toho uživatele. Bez toho by šlo označkovat cizí řádek
 * podle uhodnutého id — sice by to nic neprozradilo, ale zapisovat do cizích dat se nemá.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFrom(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { status, note } = Body.parse(await req.json());

    const owned = await prisma.businessResult.findFirst({
      where: { id: params.id, search: { userId: session.userId } },
      select: { id: true },
    });
    if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const tag = await prisma.leadTag.upsert({
      where: { userId_businessResultId: { userId: session.userId, businessResultId: params.id } },
      create: { userId: session.userId, businessResultId: params.id, status, note },
      update: { status, note },
      select: { businessResultId: true, status: true, note: true },
    });

    return NextResponse.json({ tag });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 422 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
