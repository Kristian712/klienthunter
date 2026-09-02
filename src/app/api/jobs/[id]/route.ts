import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { runSearchJob, sweepStaleJobs } from '@/lib/search-job';

/**
 * Stejný strop jako u `/api/search`: tahle route hledání nejen hlásí, ale i navazuje, takže
 * v ní běží úplně stejná práce. Bez toho by navazující fáze umřely na výchozím stropu funkce.
 */
export const maxDuration = 300;

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

  /**
   * Navázání pozastaveného hledání.
   *
   * Hledání přes celou ČR se do jedné invokace nevejde, takže se po vyčerpání rozpočtu uloží
   * jako `paused`. Rozjede ho zpátky právě tenhle dotaz — ten, kterým se prohlížeč stejně ptá
   * na průběh. Cena je jasně daná: hledání běží, jen dokud má uživatel stránku otevřenou.
   * UI to říká nahlas, protože tiché zastavení na půl cesty by bylo horší než čekání.
   *
   * Podmínka `status: 'paused'` uvnitř `updateMany` je pojistka proti souběhu: dva dotazy,
   * které dorazí ve stejnou chvíli, přepnou stav oba, ale uspěje jen jeden — druhý dostane
   * `count === 0` a hledání nespustí podruhé.
   */
  if (job.status === 'paused') {
    const claimed = await prisma.searchJob.updateMany({
      where: { id: job.id, status: 'paused' },
      data: { status: 'queued' },
    });
    if (claimed.count === 1) {
      job.status = 'queued';
      const work = runSearchJob(job.id);
      // Lokální `next dev` kontext požadavku nemá a `waitUntil` v něm vyhodí výjimku. Tam se
      // na hledání počká — vývojáře to nezdrží a chování zůstane stejné.
      try {
        waitUntil(work);
      } catch {
        await work;
      }
    }
  }

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
