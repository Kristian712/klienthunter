import { prisma } from './db';
import { isAllIndustries } from './industries';
import { activeOptoutKeys } from './optout';
import { nuts3ForRegion } from './regions-nuts';
import { fetchSubject } from './sources/ares';
import { naceCodesFor, naceWhere } from './sources/registry';
import type { RawLead } from './sources/types';

/**
 * Denní dávka: „Nové firmy ve vašem kraji" na přehledu, bez hledání.
 *
 * Konkurence (LeedFinder) prodává „10 příležitostí denně". My na to máme index z ČSÚ
 * (lib/registry-index.ts): kolik firem vzniklo v kraji uživatele za posledních
 * `DIGEST_WINDOW_DAYS` dní, kolik z nich je v jeho oboru a kolik přibylo od chvíle, kdy se
 * díval naposledy. Pár nejnovějších se dohledá v ARESu, aby karta měla jména, ne jen čísla.
 *
 * Co karta říká poctivě: index sahá jen k datu posledního dumpu ČSÚ (dvakrát měsíčně), takže
 * „dnes" tu nestojí — stojí tu „vznik do <datum>". Opravdu denní čerstvost přinese až feed
 * změn z ARESu (etapa 4).
 *
 * „Nové od minule" = firmy se vznikem po `User.digestFoundedAt`, tedy po nejmladším datu,
 * které uživatel při minulé návštěvě viděl. Datum, ne čas návštěvy: mezi dvěma importy se
 * index nemění a čas by tvrdil „nic nového", i když uživatel ještě nic neviděl.
 */
export const DIGEST_WINDOW_DAYS = 30;
export const DIGEST_PREVIEW = 5;

export interface DigestFirm {
  ico: string;
  name: string;
  address: string | null;
  foundedAt: string;
}

export interface Digest {
  /** Region z profilu, nebo null — pak karta vyzve k nastavení profilu. */
  region: string | null;
  /** Obor z profilu, nebo null = všechny obory. */
  industry: string | null;
  windowDays: number;
  /** Nejmladší datum vzniku v indexu (kam index sahá). Null = index je prázdný. */
  indexUntil: string | null;
  /** Firmy v kraji za okno: všechny obory a jen obor uživatele. */
  totalAll: number;
  totalMine: number;
  /** Kolik z `totalMine` (nebo `totalAll` bez oboru) má vznik po minulé návštěvě. Null = první návštěva. */
  newSinceLast: number | null;
  /** Kdy naposledy doběhl denní feed z ARESu. Null = ještě nikdy; karta pak neslibuje „každý den". */
  feedAt: string | null;
  preview: DigestFirm[];
}

/** Jména z ARESu se pamatují chvíli v paměti instance — pět dotazů na každé otevření přehledu by bylo zbytečných. */
const nameCache = new Map<string, { lead: RawLead | null; at: number }>();
const NAME_TTL_MS = 60 * 60 * 1000;

async function subjectCached(ico: string): Promise<RawLead | null> {
  const hit = nameCache.get(ico);
  if (hit && Date.now() - hit.at < NAME_TTL_MS) return hit.lead;
  const lead = await fetchSubject(ico);
  nameCache.set(ico, { lead, at: Date.now() });
  return lead;
}

function scopeWhere(nuts3: string, since: Date, codes: string[]) {
  return { district: { startsWith: nuts3 }, foundedAt: { gte: since }, ...(codes.length ? naceWhere(codes) : {}) };
}

export async function buildDigest(userId: string): Promise<Digest> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { targetRegion: true, targetIndustry: true, digestFoundedAt: true },
  });
  const region = user?.targetRegion ?? null;
  const nuts3 = region ? nuts3ForRegion(region) : null;
  const industry = user?.targetIndustry && !isAllIndustries(user.targetIndustry) ? user.targetIndustry : null;
  const codes = industry ? naceCodesFor(industry) : [];
  const empty: Digest = { region, industry, windowDays: DIGEST_WINDOW_DAYS, indexUntil: null, totalAll: 0, totalMine: 0, newSinceLast: null, feedAt: null, preview: [] };
  if (!nuts3) return empty;

  const since = new Date(Date.now() - DIGEST_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [agg, totalAll, totalMine, feed] = await Promise.all([
    prisma.registrySubject.aggregate({ _max: { foundedAt: true } }),
    prisma.registrySubject.count({ where: scopeWhere(nuts3, since, []) }),
    codes.length ? prisma.registrySubject.count({ where: scopeWhere(nuts3, since, codes) }) : Promise.resolve(0),
    prisma.registryFeedBatch.findFirst({ orderBy: { processedAt: 'desc' }, select: { processedAt: true } }),
  ]);
  const feedAt = feed?.processedAt.toISOString() ?? null;
  if (!agg._max.foundedAt) return empty;

  // Obor bez NACE (volný text) se v indexu nenajde — pak platí čísla za všechny obory. Totéž,
  // když v oboru za celé okno nevznikla ani jedna firma (zubaři v kraji za měsíc): prázdná
  // ukázka by vypadala jako chyba, tak se ukážou nejnovější firmy bez ohledu na obor.
  const mineCodes = codes.length && totalMine > 0 ? codes : [];
  const newSinceLast = user?.digestFoundedAt
    ? await prisma.registrySubject.count({ where: { ...scopeWhere(nuts3, since, mineCodes), foundedAt: { gt: user.digestFoundedAt } } })
    : null;

  const rows = await prisma.registrySubject.findMany({
    where: scopeWhere(nuts3, since, mineCodes),
    orderBy: { foundedAt: 'desc' },
    select: { ico: true, foundedAt: true },
    take: DIGEST_PREVIEW * 2,
  });
  const blocked = await activeOptoutKeys(rows.map(r => r.ico));
  const picked = rows.filter(r => !blocked.has(r.ico)).slice(0, DIGEST_PREVIEW);
  const leads = await Promise.all(picked.map(r => subjectCached(r.ico)));
  const preview: DigestFirm[] = picked.flatMap((r, i) => {
    const lead = leads[i];
    return lead ? [{ ico: r.ico, name: lead.name, address: lead.address ?? null, foundedAt: r.foundedAt.toISOString() }] : [];
  });

  return {
    region, industry, windowDays: DIGEST_WINDOW_DAYS,
    indexUntil: agg._max.foundedAt.toISOString(),
    totalAll, totalMine: codes.length ? totalMine : totalAll,
    newSinceLast, feedAt, preview,
  };
}

/** Uživatel kartu viděl: od teď je „nové" jen to, co vzniklo po nejmladší firmě, kterou měl před sebou. */
export async function markDigestSeen(userId: string): Promise<void> {
  const agg = await prisma.registrySubject.aggregate({ _max: { foundedAt: true } });
  if (!agg._max.foundedAt) return;
  await prisma.user.update({ where: { id: userId }, data: { digestFoundedAt: agg._max.foundedAt } });
}
