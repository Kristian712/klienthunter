import { prisma } from './db';
import { persistResults } from './lead-persist';
import { enrichAndVerify, mergeLeads } from './lead-pipeline';
import { fillCoordinates } from './ruian';
import { discoverAll } from './sources';

/**
 * Hledání, které běží po odeslání odpovědi.
 *
 * Do teď se celé hledání odbývalo uvnitř jednoho HTTP požadavku: uživatel čekal padesát sekund
 * s otevřenou kartou, a když ji zavřel, přišel o všechno. Strop funkce navíc určoval, kolik
 * zdrojů dat si vůbec můžeme dovolit — každý další by hledání položil.
 *
 * Route teď založí `SearchJob`, vrátí jeho id a tuhle funkci pustí přes `waitUntil`. Ta běží
 * dál v téže invokaci, jen už bez čekajícího prohlížeče. Průběh a výsledky se ukládají do
 * databáze, takže se uživatel může kdykoli vrátit — a export funguje i nad rozpracovaným během,
 * protože čte tytéž řádky.
 *
 * Co tahle varianta neumí a je dobré to vědět: nedokáže se po pádu instance sama zopakovat
 * a nepřekročí strop funkce (300 s na Hobby plánu). Job, který se z běhu nikdy nevrátí, uklidí
 * `sweepStaleJobs()` níž.
 */

/** Po kolika firmách se zapisuje do databáze. */
const BATCH = 25;

/**
 * Kolik času si necháváme na síť. Pod stropem funkce (300 s) s rezervou na zápis a na dobíhající
 * úlohy — `runPool` kontroluje hodiny jen než úlohu spustí, takže po vypršení rozpočtu ještě
 * doběhne nejvýš `PER_CANDIDATE_MS` z lead-pipeline.
 */
const NETWORK_BUDGET_MS = 270_000;

/** Job, který se takhle dlouho neposunul, už se nevrátí — instance ho vzala s sebou. */
export const STALE_AFTER_MS = 5 * 60 * 1000;

const WHOLE_CZ_TRIGGERS = ['celá čr', 'cela cr', 'celá cr', 'celé česko'];
const isWholeCz = (region: string) => WHOLE_CZ_TRIGGERS.includes(region.toLowerCase().trim());

export async function runSearchJob(jobId: string): Promise<void> {
  const job = await prisma.searchJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== 'queued') return;

  const user = await prisma.user.findUnique({
    where: { id: job.userId },
    select: { targetFilters: true },
  });

  try {
    await prisma.searchJob.update({
      where: { id: jobId },
      data: { status: 'running', startedAt: new Date() },
    });

    const deadlineAt = Date.now() + NETWORK_BUDGET_MS;
    const wholeCz = isWholeCz(job.region);
    const city = wholeCz ? '' : job.region.split(',')[0].trim();

    const limit = job.foundCount > 0 ? job.foundCount : 500;
    const [aresLeads, osmLeads] = await discoverAll(job.industry, city, limit);
    const candidates = mergeLeads([osmLeads, aresLeads], limit);

    // Počet nalezených firem známe dřív než jejich weby, a uživatel na něj kouká hned —
    // je to první číslo, ze kterého pozná, že se něco děje.
    await prisma.searchJob.update({
      where: { id: jobId },
      data: { foundCount: candidates.length },
    });

    /**
     * Souřadnice z RÚIAN, ještě než se začnou ověřovat weby.
     *
     * Musí to být tady: `persistResults` zapisuje `lat`/`lon` z kandidáta, takže kdyby se
     * doplňovaly až potom, první dávky by na mapě chyběly. Stojí to jedno stažení na obec
     * (řádově desetiny sekundy) a selhání ČÚZK hledání nepoloží — firmy jen zůstanou bez bodu.
     */
    await fillCoordinates(candidates);

    let processed = 0;
    await enrichAndVerify(candidates, {
      probeNetwork: !wholeCz,
      deadlineAt,
      region: job.region,
      industry: job.industry,
      batchSize: BATCH,
      onBatch: async batch => {
        await persistResults(job.searchId, batch, user?.targetFilters);
        processed += batch.length;
        await prisma.searchJob.update({
          where: { id: jobId },
          data: { processedCount: processed },
        });
      },
    });

    await prisma.searchJob.update({
      where: { id: jobId },
      data: { status: 'done', processedCount: processed, finishedAt: new Date() },
    });
  } catch (err) {
    // Co je zapsané, zůstává. Uživatel uvidí částečný výsledek i důvod, proč není celý.
    await prisma.searchJob
      .update({
        where: { id: jobId },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          error: err instanceof Error ? err.message.slice(0, 300) : 'Neznámá chyba',
        },
      })
      .catch(() => undefined);
  }
}

/**
 * Označí za spadlé ty joby, které se dlouho neposunuly.
 *
 * Kdyby instanci Vercel ukončil uprostřed práce, zůstal by job navždycky ve stavu `running`
 * a uživatel by čekal na něco, co už neběží. Schválně to nedělá cron: na Hobby plánu je jejich
 * frekvence omezená a tahle úklidová práce se stejně hodí přesně ve chvíli, kdy se uživatel
 * dívá na seznam. Jeden UPDATE, žádná další infrastruktura.
 */
export async function sweepStaleJobs(userId: string): Promise<void> {
  await prisma.searchJob
    .updateMany({
      where: {
        userId,
        status: { in: ['queued', 'running'] },
        updatedAt: { lt: new Date(Date.now() - STALE_AFTER_MS) },
      },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        error: 'Hledání se zastavilo dřív, než doběhlo. Co se stihlo najít, zůstalo uložené.',
      },
    })
    .catch(() => undefined);
}
