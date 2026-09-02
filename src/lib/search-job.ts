import { prisma } from './db';
import { persistResults } from './lead-persist';
import { enrichAndVerify, mergeLeads } from './lead-pipeline';
import { fillCoordinates } from './ruian';
import { CZ_STAGES } from './search-options';
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

/**
 * Kolik času musí zbývat, aby mělo smysl začínat další fázi.
 *
 * Fáze je celé hledání v jednom městě — dotaz do ARESu, dotaz na Overpass, souřadnice
 * a ověřování webů. Pod minutu se z toho nestihne nic užitečného, a rozdělaná fáze by jen
 * zbytečně spálila rozpočet, který má navazující běh využít celý.
 */
const STAGE_MIN_MS = 60_000;

/** Job, který se takhle dlouho neposunul, už se nevrátí — instance ho vzala s sebou. */
export const STALE_AFTER_MS = 5 * 60 * 1000;

const WHOLE_CZ_TRIGGERS = ['celá čr', 'cela cr', 'celá cr', 'celé česko'];
const isWholeCz = (region: string) => WHOLE_CZ_TRIGGERS.includes(region.toLowerCase().trim());

/**
 * Na kolik dávek se hledání rozpadne. Běžné hledání má jednu fázi — samo město, jak ho
 * uživatel vybral. „Celá ČR" má čtrnáct, protože jeden dotaz na celou republiku ARES odmítne
 * dřív, než stihne cokoli vrátit (viz `CZ_STAGES`).
 */
function stagesFor(region: string): { value: string; label: string }[] {
  if (isWholeCz(region)) return CZ_STAGES;
  return [{ value: region, label: region.split(',')[0].trim() }];
}

export async function runSearchJob(jobId: string): Promise<void> {
  const job = await prisma.searchJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== 'queued') return;

  const user = await prisma.user.findUnique({
    where: { id: job.userId },
    select: { targetFilters: true },
  });

  try {
    const deadlineAt = Date.now() + NETWORK_BUDGET_MS;
    const stages = stagesFor(job.region);
    const startAt = Math.min(job.stageIndex, stages.length - 1);

    await prisma.searchJob.update({
      where: { id: jobId },
      data: {
        status: 'running',
        // Čas *tohoto* běhu, ne celé úlohy. Navazující běh začíná znovu a odhad zbývajícího
        // času se u vícefázového hledání stejně neukazuje (viz search/page.tsx).
        startedAt: new Date(),
        stageCount: stages.length,
        stageLabel: stages[startAt].label,
      },
    });

    /**
     * Co už v databázi je, se nesmí objevit podruhé.
     *
     * Fáze jsou města, ale firmy nejsou: sídlo v Brně a provozovna v Ostravě znamenají, že
     * tutéž firmu vrátí dvě různé fáze. `persistResults` nekontroluje nic, takže duplicitu
     * musí uhlídat volající. Načítá se jednou, pak se množina doplňuje průběžně — a při
     * navázání se načte znovu, takže funguje i přes hranici běhů.
     */
    const written = await prisma.businessResult.findMany({
      where: { searchId: job.searchId },
      select: { ico: true, placeId: true },
    });
    const seenIco = new Set(written.map(r => r.ico).filter((v): v is string => Boolean(v)));
    const seenPlace = new Set(written.map(r => r.placeId).filter((v): v is string => Boolean(v)));

    const perStage = Math.ceil(job.targetCount / stages.length);
    let processed = job.processedCount;
    let total = written.length;
    let index = startAt;

    for (; index < stages.length; index++) {
      if (total >= job.targetCount) break;
      // První fáze běhu se pouští vždycky — jinak by se job mohl přepnout do `paused`, aniž
      // by se pohnul, a navazoval by donekonečna. Další už jen když je na ni čas.
      if (index > startAt && Date.now() > deadlineAt - STAGE_MIN_MS) break;

      const stage = stages[index];
      await prisma.searchJob.update({
        where: { id: jobId },
        data: { stageIndex: index, stageLabel: stage.label },
      });

      const room = Math.min(perStage, job.targetCount - total);
      const city = stage.value.split(',')[0].trim();
      const [aresLeads, osmLeads] = await discoverAll(job.industry, city, room);
      const candidates = mergeLeads([osmLeads, aresLeads], room).filter(c => {
        if (seenIco.has(c.ico ?? '') || seenPlace.has(c.placeId)) return false;
        if (c.ico) seenIco.add(c.ico);
        seenPlace.add(c.placeId);
        return true;
      });

      // Počet nalezených firem známe dřív než jejich weby, a uživatel na něj kouká hned —
      // je to první číslo, ze kterého pozná, že se něco děje. Přičítá se, protože fází je víc.
      await prisma.searchJob.update({
        where: { id: jobId },
        data: { foundCount: { increment: candidates.length } },
      });

      /**
       * Souřadnice z RÚIAN, ještě než se začnou ověřovat weby.
       *
       * Musí to být tady: `persistResults` zapisuje `lat`/`lon` z kandidáta, takže kdyby se
       * doplňovaly až potom, první dávky by na mapě chyběly. Stojí to jedno stažení na obec
       * (řádově desetiny sekundy) a selhání ČÚZK hledání nepoloží — firmy jen zůstanou bez bodu.
       */
      await fillCoordinates(candidates);

      await enrichAndVerify(candidates, {
        // Dřív tu u „celé ČR" stálo `false`, protože se do jednoho průchodu měly vejít tisíce
        // sond. Po rozpadu na fáze je jedna fáze objemem běžné hledání, takže se ověřuje
        // úplně stejně — a „celá ČR" přestala být jediné hledání bez ověřených webů.
        probeNetwork: true,
        deadlineAt,
        region: stage.value,
        industry: job.industry,
        batchSize: BATCH,
        onBatch: async batch => {
          const rows = await persistResults(job.searchId, batch, user?.targetFilters);
          processed += batch.length;
          total += rows.length;
          await prisma.searchJob.update({
            where: { id: jobId },
            data: { processedCount: processed },
          });
        },
      });
    }

    const finished = index >= stages.length || total >= job.targetCount;
    await prisma.searchJob.update({
      where: { id: jobId },
      data: finished
        ? {
            status: 'done',
            processedCount: processed,
            stageIndex: stages.length,
            finishedAt: new Date(),
          }
        // Ne `failed`: nic se nepokazilo, jen došel čas jedné invokace. Job čeká na `paused`
        // a naváže od `stageIndex`, jakmile se klient znovu zeptá na stav.
        : { status: 'paused', processedCount: processed, stageIndex: index, stageLabel: stages[index].label },
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
