import { waitUntil } from '@vercel/functions';
import { activeAccount, getPlanLimits } from './auth';
import { prisma } from './db';
import { isAllIndustries } from './industries';
import { nuts3ForRegion } from './regions-nuts';
import { runSearchJob } from './search-job';

/**
 * Založí hledání přihlášeného uživatele a spustí ho na pozadí.
 *
 * Do 13. 9. 2026 to bylo tělo `POST /api/search`. Vytáhlo se sem, protože totéž potřebuje
 * „Spustit znovu" u uloženého hledání (`POST /api/searches/[id]/rerun`) — a dvě kopie limitů
 * tarifu by se dřív nebo později rozešly.
 */

/**
 * Nárazová pojistka nad rámec měsíčního limitu plánu.
 *
 * Každé hledání střílí dotaz na veřejný Overpass, který ve svých podmínkách výslovně žádá,
 * aby ho nikdo nepoužíval jako backendovou infrastrukturu. Měsíční limit plánu tohle neřeší:
 * plány VIP, BUSINESS a admin ho mají nekonečný, a i konečný limit dovolí vystřílet celý
 * měsíční příděl během minuty. Kdyby Overpass zablokoval naši IP, přijdou o kontakty všichni
 * uživatelé najednou — proto tenhle strop platí pro každého včetně adminů.
 *
 * Dvanáct za pět minut je nad rámec toho, co stihne člověk, který si výsledky opravdu čte.
 */
const BURST_WINDOW_MS = 5 * 60 * 1000;
const BURST_MAX = 12;

export type StartSearchResult =
  | { ok: true; jobId: string; searchId: string }
  | { ok: false; status: 401 | 403 | 422 | 429; code: 'UNAUTHORIZED' | 'PLAN_LIMIT' | 'RATE_LIMITED' | 'ALL_NEEDS_EVENT'; retryAfterS?: number };

export async function startSearch(opts: {
  userId: string;
  industry: string;
  region: string;
  /** Kořen uloženého hledání, jehož je tenhle běh dalším spuštěním. */
  savedId?: string | null;
  /** Jen informativní otisk v okamžiku spuštění; čte se vždy kořen (`searchMeta`). */
  filters?: string[];
  scenario?: string | null;
  /** Okresy (LAU 1) ze skládačky; platí jen pro hledání přes index. */
  districts?: string[];
}): Promise<StartSearchResult> {
  // „Všechny obory" (i prázdný obor) umí jen index z ČSÚ, a ten pokrývá jen české kraje. Bez filtru
  // podle vzniku se vezme celé okno indexu (viz `effectiveWindowDays`); mimo české kraje by běh šel
  // do ARESu bez NACE a ten ho odmítne — lepší říct to hned než po minutě.
  if (isAllIndustries(opts.industry) && nuts3ForRegion(opts.region) === null) {
    return { ok: false, status: 422, code: 'ALL_NEEDS_EVENT' };
  }

  // Počítáme už založená hledání, ne dokončená — jinak by série souběžných požadavků
  // proklouzla všechna najednou, protože žádné z nich by v tu chvíli ještě nebylo hotové.
  const burstSince = new Date(Date.now() - BURST_WINDOW_MS);
  const recent = await prisma.search.count({ where: { userId: opts.userId, createdAt: { gte: burstSince } } });
  if (recent >= BURST_MAX) {
    return { ok: false, status: 429, code: 'RATE_LIMITED', retryAfterS: Math.ceil(BURST_WINDOW_MS / 1000) };
  }

  // Tarif z databáze, ne z tokenu: kdo právě zaplatil, má vyšší limit hned.
  const account = await activeAccount(opts.userId);
  if (!account) return { ok: false, status: 401, code: 'UNAUTHORIZED' };
  const limits = getPlanLimits(account.plan, account.isVip, account.isAdmin);

  if (limits.searches !== Infinity) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const searchCount = await prisma.search.count({
      where: { userId: opts.userId, createdAt: { gte: thirtyDaysAgo } },
    });
    if (searchCount >= limits.searches) return { ok: false, status: 403, code: 'PLAN_LIMIT' };
  }

  const search = await prisma.search.create({
    data: {
      userId: opts.userId,
      query: opts.industry,
      region: opts.region,
      savedId: opts.savedId ?? null,
      filters: opts.filters ?? [],
      scenario: opts.scenario ?? null,
      districts: opts.districts ?? [],
    },
  });

  // `resultsPerSearch` z plánu jde do `targetCount` — vstupní strop, ne výsledek.
  const job = await prisma.searchJob.create({
    data: {
      userId: opts.userId,
      searchId: search.id,
      region: opts.region,
      industry: opts.industry,
      targetCount: limits.resultsPerSearch === Infinity ? 500 : limits.resultsPerSearch,
    },
  });

  // Lokální `next dev` žádný kontext požadavku nemá a `waitUntil` v něm vyhodí výjimku.
  // Tam se prostě počká — vývojáře to nezdrží a chování zůstane stejné.
  const work = runSearchJob(job.id);
  try {
    waitUntil(work);
  } catch {
    await work;
  }

  return { ok: true, jobId: job.id, searchId: search.id };
}
