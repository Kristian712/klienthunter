import { NextRequest, NextResponse } from 'next/server';
import { sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sweepStaleJobs } from '@/lib/search-job';

/**
 * Stav jednoho hledání a řádky, které k němu zatím přibyly.
 *
 * Prohlížeč se ptá co dvě sekundy, takže posílat pokaždé všech pět set firem by bylo přes tři
 * sta kilobajtů na dotaz. Parametr `from` je počet řádků, které klient už má; vrací se jen ty
 * novější. Řádky vždycky jen přibývají, takže prosté přeskočení prvních `from` je bezpečné.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFrom(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await sweepStaleJobs(session.userId);

  // Scoped by userId: cizí id musí vypadat jako neexistující, ne jako zakázané.
  const job = await prisma.searchJob.findFirst({
    where: { id: params.id, userId: session.userId },
  });
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const from = Math.max(0, Number(req.nextUrl.searchParams.get('from') ?? 0) || 0);
  const results = await prisma.businessResult.findMany({
    where: { searchId: job.searchId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    skip: from,
    // Značky patří přihlášenému uživateli, takže se dotahují filtrované na něj. Kdyby se
    // vybíraly všechny, viděl by, jak si tutéž firmu označil někdo jiný.
    include: { tags: { where: { userId: session.userId }, select: { status: true, note: true } } },
  });

  return NextResponse.json({ job, results });
}
