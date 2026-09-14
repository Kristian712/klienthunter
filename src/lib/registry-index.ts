import { Readable } from 'node:stream';
import Papa from 'papaparse';
import { prisma } from './db';
import { REGISTRY_INDEX_MONTHS } from './registry-index-config';

/**
 * Index ekonomických subjektů z otevřených dat ČSÚ (RES).
 *
 * Zdroj: https://opendata.csu.gov.cz/soubory/od/od_org03/res_data.csv — celý registr (2,9 mil.
 * aktivních subjektů, 543 MB), 2× měsíčně, licence CC BY 4.0 (uvést zdroj, viz patička a stránka
 * o zdrojích dat). Bereme z něj jen aktivní subjekty se vznikem v posledních
 * `REGISTRY_INDEX_MONTHS` měsících a jen registrová pole — žádná jména ani adresy.
 *
 * Proč vůbec: ARES neumí filtrovat ani řadit podle data vzniku (ověřeno 13. 9. 2026), takže
 * „firmy vzniklé za 30 dní v kraji" jinak nejdou získat. Index říká KOHO dohledat; detail se
 * bere z ARESu až u firem, které projdou filtrem.
 *
 * Rozsah (`REGISTRY_INDEX_MONTHS`) je v registry-index-config.ts, aby ho šlo číst bez Prismy.
 */
export { REGISTRY_INDEX_MONTHS };
export const RES_URL = 'https://opendata.csu.gov.cz/soubory/od/od_org03/res_data.csv';
export const RES_ATTRIBUTION = 'Registr ekonomických subjektů, Český statistický úřad, CC BY 4.0';

const BATCH = 1_000;

interface ResRow {
  ICO: string; DDATVZN: string; DDATZAN: string; DDATPAKT: string; FORMA: string;
  NACE: string; KATPO: string; OKRESLAU: string; ICZUJ: string;
}

function cutoffDate(now = new Date()): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() - REGISTRY_INDEX_MONTHS);
  return d;
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface ImportProgress {
  scanned: number;
  kept: number;
  cursorIco: string | null;
  done: boolean;
}

/**
 * Jeden běh importu. Streamuje CSV, filtruje za pochodu, zapisuje po dávkách. Kdykoli může
 * skončit na `deadlineMs` (Vercel funkce má 300 s) — dump je řazený podle IČO, takže další běh
 * naváže od `cursorIco` a nic se nezpracuje dvakrát. Po úplném průchodu smaže řádky, které tenhle
 * běh nepotvrdil (subjekt zanikl nebo vypadl z okna).
 */
export async function runRegistryImport(opts: {
  deadlineMs: number;
  resumeFrom?: string | null;
  /** Místo stažení z ČSÚ číst z tohoto streamu (lokální kopie dumpu při ladění). */
  input?: Readable;
  onProgress?: (p: ImportProgress) => Promise<void>;
}): Promise<ImportProgress> {
  const startedAt = new Date();
  const cutoff = cutoffDate(startedAt);
  let stream: Readable;
  if (opts.input) {
    stream = opts.input;
  } else {
    const res = await fetch(RES_URL, { headers: { 'Accept-Encoding': 'gzip, deflate' } });
    if (!res.ok || !res.body) throw new Error(`ČSÚ RES: HTTP ${res.status}`);
    stream = Readable.fromWeb(res.body as never);
  }

  const progress: ImportProgress = { scanned: 0, kept: 0, cursorIco: opts.resumeFrom ?? null, done: false };
  let batch: Array<{ ico: string; foundedAt: Date; legalForm: string; nace: string | null; employeeCategory: string | null; district: string; municipality: number | null; registryUpdatedAt: Date | null; importedAt: Date }> = [];
  let skippingUntil = opts.resumeFrom ?? null;
  let stopped = false;

  const flush = async () => {
    if (batch.length === 0) return;
    const rows = batch; batch = [];
    // Nahradit, ne slučovat: řádek indexu je snímek registru, ne něco, co bychom sami doplňovali.
    await prisma.registrySubject.deleteMany({ where: { ico: { in: rows.map(r => r.ico) } } });
    await prisma.registrySubject.createMany({ data: rows, skipDuplicates: true });
    progress.kept += rows.length;
    progress.cursorIco = rows[rows.length - 1].ico;
    if (opts.onProgress) await opts.onProgress(progress);
  };

  await new Promise<void>((resolve, reject) => {
    Papa.parse<ResRow>(stream, {
      header: true,
      skipEmptyLines: true,
      step: (result, parser) => {
        if (stopped) return;
        const r = result.data;
        progress.scanned++;
        if (skippingUntil && r.ICO <= skippingUntil) return;
        skippingUntil = null;
        if (r.DDATZAN) return;
        const founded = parseDate(r.DDATVZN);
        if (!founded || founded < cutoff) return;
        batch.push({
          ico: r.ICO.padStart(8, '0'),
          foundedAt: founded,
          legalForm: r.FORMA || '',
          nace: r.NACE || null,
          employeeCategory: r.KATPO || null,
          district: r.OKRESLAU || '',
          municipality: r.ICZUJ ? Number(r.ICZUJ) : null,
          registryUpdatedAt: parseDate(r.DDATPAKT),
          importedAt: startedAt,
        });
        if (batch.length >= BATCH) {
          parser.pause();
          flush()
            .then(() => {
              if (Date.now() > opts.deadlineMs) { stopped = true; parser.abort(); resolve(); }
              else parser.resume();
            })
            .catch(reject);
        }
      },
      complete: () => { flush().then(() => resolve()).catch(reject); },
      error: reject,
    });
  });

  if (!stopped) {
    // Úplný průchod: co tenhle běh nepotvrdil, v registru už není (nebo vypadlo z okna).
    // Firmy z denního feedu ARESu (etapa 4) mladší než 60 dní se nechávají: ČSÚ je má v dumpu
    // až s odstupem a mazat je by znamenalo, že „nová od včera" po importu zmizí.
    const keepSince = new Date(startedAt.getTime() - 60 * 24 * 60 * 60 * 1000);
    await prisma.registrySubject.deleteMany({
      where: { importedAt: { lt: startedAt }, OR: [{ firstSeenAt: null }, { firstSeenAt: { lt: keepSince } }] },
    });
    progress.done = true;
    progress.cursorIco = null;
  }
  return progress;
}

/** Kolik index zabírá a kolik má řádků — číslo, podle kterého se rozsah rozšiřuje. */
export async function registryIndexStats(): Promise<{ rows: number; bytes: number; oldest: Date | null; newest: Date | null }> {
  const [size] = await prisma.$queryRaw<Array<{ bytes: bigint }>>`SELECT pg_total_relation_size('"RegistrySubject"') AS bytes`;
  const agg = await prisma.registrySubject.aggregate({ _count: { ico: true }, _min: { foundedAt: true }, _max: { foundedAt: true } });
  return { rows: agg._count.ico, bytes: Number(size.bytes), oldest: agg._min.foundedAt, newest: agg._max.foundedAt };
}
