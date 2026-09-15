import { prisma } from './db';
import { PRIOR_SELECT, persistFromPrior, persistResults, type PriorRow } from './lead-persist';
import { firmKeyOf } from './claim-order';
import { enrichAndVerify, mergeLeads } from './lead-pipeline';
import { fillCoordinates } from './ruian';
import { CZ_STAGES } from './search-options';
import { isWholeCz } from './regions-nuts';
import { ALL_INDUSTRIES, isAllIndustries, splitIndustries } from './industries';
import { SOLE_TRADER_FORMS, effectiveWindowDays, indexConstraints, normalizeFilters } from './lead-filters';
import { scenarioById } from './scenarios';
import { discoverAll, type RawLead } from './sources';
import { notifySearchDone } from './webhook';
import { createSearchQuota } from './web-search-quota';
import { fetchAdvertisers, indexAdvertisers, matchAdvertiser, metaAdsEnabled } from './sources/meta-ads';

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

/**
 * Právní formy „obchodní společnosti" pro dotaz do ARESu: v.o.s., s.r.o., k.s., a.s., družstvo
 * a organizační složky zahraničních firem. Index má „cokoli kromě 100/101", tady se musí vyjmenovat.
 */
const COMPANY_FORMS = ['111', '112', '113', '121', '205', '421', '424'];

/** Po kolika firmách se zapisuje do databáze. */
const BATCH = 25;

/**
 * Kolik času smí vzít doplnění souřadnic z RÚIAN. Hledání v celém kraji sype firmy ze stovek
 * obcí a každá obec je jedno stažení; dřív platil strop 25 obcí a na mapě chyběla skoro
 * polovina firem. Minuta z 270sekundového rozpočtu stačí na zhruba 300 obcí.
 */
const COORDS_BUDGET_MS = 60_000;

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

/**
 * Strop placených dotazů do vyhledávače na jedno celé hledání — přes všechny fáze i navazující běhy.
 *
 * Dřív platil pro jedno volání `enrichAndVerify`, tedy pro jednu fáze, a „Celá ČR" se čtrnácti fázemi
 * smělo položit 1 400 dotazů. Nad tímhle stropem hlídá měsíční strop celé aplikace (web-search-quota.ts).
 */
const MAX_WEB_SEARCHES = Number(process.env.MAX_WEB_SEARCHES ?? 100);

/** Job, který se takhle dlouho neposunul, už se nevrátí — instance ho vzala s sebou. */
export const STALE_AFTER_MS = 5 * 60 * 1000;

/**
 * Na kolik dávek se hledání rozpadne. Běžné hledání má jednu fázi — samo město, jak ho
 * uživatel vybral. „Celá ČR" přes ARES má čtrnáct, protože jeden dotaz na celou republiku ARES
 * odmítne dřív, než stihne cokoli vrátit (viz `CZ_STAGES`). Přes index (filtr podle vzniku
 * nebo bez oboru) je celá ČR jeden dotaz do databáze, tedy jedna fáze.
 */
function stagesFor(region: string, viaIndex: boolean): { value: string; label: string }[] {
  if (isWholeCz(region)) return viaIndex ? [{ value: region, label: 'Celá ČR' }] : CZ_STAGES;
  return [{ value: region, label: region.split(',')[0].trim() }];
}

export async function runSearchJob(jobId: string): Promise<void> {
  const job = await prisma.searchJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== 'queued') return;

  const user = await prisma.user.findUnique({
    where: { id: job.userId },
    select: { targetFilters: true },
  });

  /**
   * Filtry hledání rozhodují, odkud se firmy berou. Zapnutý filtr podle vzniku (chip nebo
   * scénář „Nové firmy") přepne první zdroj z ARESu na index z ČSÚ, který umí datum i celý
   * kraj. Filtry se čtou z kořene uloženého hledání — běh nese jen kopii, která může být stará.
   */
  const search = await prisma.search.findUnique({
    where: { id: job.searchId },
    select: { filters: true, scenario: true, savedId: true, districts: true },
  });
  const root = search?.savedId
    ? await prisma.search.findUnique({ where: { id: search.savedId }, select: { filters: true, scenario: true, districts: true } })
    : null;
  const criteria = root ?? search;
  // Protiklady pryč i u starých uložených hledání (dřív šlo zapnout „živnostník" i „společnost").
  const filterIds = normalizeFilters([...(criteria?.filters ?? []), ...scenarioById(criteria?.scenario).filters]);
  // Bez oboru se hledá v indexu v celém jeho okně (pět let) — viz `effectiveWindowDays`.
  const windowDays = effectiveWindowDays(filterIds, job.industry);
  const districts = criteria?.districts ?? [];
  // Právní forma zužuje i dotaz do ARESu (filtr `pravniForma`), ne jen index — ať uživatel,
  // který chce jen s.r.o., nedostane pět set živnostníků a z nich po prořezání dvacet firem.
  const cons = indexConstraints(filterIds);
  const legalForms = cons.soleTrader && !cons.company ? SOLE_TRADER_FORMS : cons.company && !cons.soleTrader ? COMPANY_FORMS : undefined;

  try {
    const deadlineAt = Date.now() + NETWORK_BUDGET_MS;
    const stages = stagesFor(job.region, windowDays !== null);
    const startAt = Math.min(job.stageIndex, stages.length - 1);
    const searchQuota = createSearchQuota(MAX_WEB_SEARCHES - job.webSearchCount);

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

    /**
     * Dohledávání kontaktů zpětně.
     *
     * Opakovaný běh uloženého hledání nezkouší znovu weby firem, u kterých už kontakt je —
     * ty se opíšou (`persistFromPrior`) a sondy dostanou jen firmy bez kontaktu. Nejnovější
     * řádek s kontaktem na firmu vyhrává. Bez kořene (první běh) je mapa prázdná a nic se nemění.
     */
    const prior = new Map<string, PriorRow>();
    if (search?.savedId) {
      const rows = await prisma.businessResult.findMany({
        where: {
          search: { userId: job.userId, OR: [{ id: search.savedId }, { savedId: search.savedId }], id: { not: job.searchId } },
          OR: [{ phone: { not: null } }, { email: { not: null } }],
        },
        select: PRIOR_SELECT,
        orderBy: { createdAt: 'desc' },
      });
      for (const r of rows) {
        if (!r.phone && !r.email) continue;
        const key = firmKeyOf(r);
        if (!prior.has(key)) prior.set(key, r);
      }
    }

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
      /**
       * Víc oborů naráz: každý obor je vlastní průchod zdroji, místo se dělí rovným dílem.
       * „Všechny obory" je jeden průchod bez NACE — umí ho jen index z ČSÚ (viz lib/industries.ts;
       * `startSearch` bez filtru vzniku takový běh vůbec nezaloží).
       */
      const parts = isAllIndustries(job.industry) ? [ALL_INDUSTRIES] : splitIndustries(job.industry);
      const perPart = Math.ceil(room / Math.max(parts.length, 1));
      // Obory po sobě, ne naráz: každý průchod si sám paralelizuje dotazy do ARESu a pět oborů
      // najednou by přelezlo limit 500 za minutu.
      const batches: RawLead[][][] = [];
      for (const part of parts) {
        batches.push(await discoverAll(part, city, perPart, {
          registry: windowDays ? { industry: part, region: stage.value, windowDays, limit: perPart, filters: filterIds, districts } : undefined,
          legalForms,
        }));
      }
      const osmLeads = batches.flatMap(b => b[1]);
      const aresLeads = batches.flatMap(b => b[0]);
      const merged = mergeLeads([osmLeads, aresLeads], room).filter(c => {
        if (seenIco.has(c.ico ?? '') || seenPlace.has(c.placeId)) return false;
        if (c.ico) seenIco.add(c.ico);
        seenPlace.add(c.placeId);
        return true;
      });
      /**
       * Kdo z nalezených platí za reklamu na Meta. Inzerenti pro město jdou z cache nebo z API
       * (nejvýš pár volání, rozpočet 20 s), párují se podle domény nebo názvu. Bez tokenu se
       * nic neděje a řádky zůstanou bez údaje — což UI čte jako „nevíme", ne „neinzeruje".
       */
      if (metaAdsEnabled() && merged.length > 0) {
        try {
          const advertisers = await fetchAdvertisers(city, Math.min(deadlineAt, Date.now() + 20_000));
          if (advertisers.length) {
            const idx = indexAdvertisers(advertisers);
            for (const c of merged) {
              const hit = matchAdvertiser({ name: c.name, website: c.signals.claimedUrl }, idx);
              if (hit) c.ads = { pageId: hit.pageId, pageName: hit.pageName, since: hit.since, count: hit.count, linkDomain: hit.linkDomain, reach: hit.reach };
            }
          }
        } catch (err) {
          console.warn('search-job meta-ads:', err);
        }
      }
      const known = merged.flatMap(c => { const p = prior.get(firmKeyOf(c)); return p ? [{ c, prior: p }] : []; });
      const candidates = merged.filter(c => !prior.has(firmKeyOf(c)));

      // Počet nalezených firem známe dřív než jejich weby, a uživatel na něj kouká hned —
      // je to první číslo, ze kterého pozná, že se něco děje. Přičítá se, protože fází je víc.
      await prisma.searchJob.update({
        where: { id: jobId },
        data: { foundCount: { increment: merged.length } },
      });

      /**
       * Souřadnice z RÚIAN, ještě než se začnou ověřovat weby.
       *
       * Musí to být tady: `persistResults` zapisuje `lat`/`lon` z kandidáta, takže kdyby se
       * doplňovaly až potom, první dávky by na mapě chyběly. Stojí to jedno stažení na obec
       * (řádově desetiny sekundy) a selhání ČÚZK hledání nepoloží — firmy jen zůstanou bez bodu.
       */
      // Rozpočet na souřadnice: celý kraj je stovky obcí, každá je jedno stažení z ČÚZK.
      await fillCoordinates(merged, Math.min(deadlineAt, Date.now() + COORDS_BUDGET_MS));

      // Firmy s kontaktem z minula se zapíšou hned — bez sond, bez čekání na zbytek fáze.
      if (known.length > 0) {
        const copied = await persistFromPrior(job.searchId, known, user?.targetFilters);
        processed += known.length;
        total += copied;
        await prisma.searchJob.update({ where: { id: jobId }, data: { processedCount: processed } });
      }

      await enrichAndVerify(candidates, {
        // Dřív tu u „celé ČR" stálo `false`, protože se do jednoho průchodu měly vejít tisíce
        // sond. Po rozpadu na fáze je jedna fáze objemem běžné hledání, takže se ověřuje
        // úplně stejně — a „celá ČR" přestala být jediné hledání bez ověřených webů.
        probeNetwork: true,
        deadlineAt,
        region: stage.value,
        industry: job.industry,
        batchSize: BATCH,
        searchQuota,
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

      // Spotřebované dotazy se ukládají po každé fázi, aby je navazující běh odečetl od stropu hledání.
      await prisma.searchJob.update({
        where: { id: jobId },
        data: { webSearchCount: job.webSearchCount + searchQuota.used() },
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
    // Webhook až po zápisu `done`: kdo si ho nastavil, dostane hotový seznam. Selhání se jen zaloguje.
    if (finished) await notifySearchDone(job.searchId).catch(err => console.warn('search-job webhook:', err));
  } catch (err) {
    console.error('search-job:', jobId, err);
    // Co je zapsané, zůstává. Uživatel uvidí částečný výsledek i důvod, proč není celý.
    await prisma.searchJob
      .update({
        where: { id: jobId },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          /**
           * Kód, ne text výjimky.
           *
           * Dřív se sem ukládalo `err.message` a stránka ho vypisovala tak, jak přišlo — uživatel
           * si přečetl `Invalid prisma.businessResult.create() … ETIMEDOUT`. Nic mu to neřeklo
           * a ven to neslo vnitřnosti aplikace. Podrobnost patří do logu, na obrazovku kód,
           * který si UI přeloží.
           */
          error: errorCode(err),
        },
      })
      .catch(() => undefined);
  }
}

/**
 * Z výjimky udělá jedno ze čtyř slov, kterým rozumí UI: `db`, `network`, `timeout`, `unknown`.
 * Překlad na větu je na straně prohlížeče, aby ji uživatel dostal ve svém jazyce.
 */
function errorCode(err: unknown): string {
  const text = err instanceof Error ? `${err.name} ${err.message}` : String(err ?? '');
  if (/prisma|database|ECONNREFUSED|connection/i.test(text)) return 'db';
  if (/ETIMEDOUT|AbortError|timeout|deadline/i.test(text)) return 'timeout';
  if (/fetch|ENOTFOUND|ECONNRESET|network|socket/i.test(text)) return 'network';
  return 'unknown';
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
        error: 'timeout',
      },
    })
    .catch(() => undefined);
}
