import https from 'node:https';
import type { Readable } from 'node:stream';
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
/** Hlavička dumpu (ověřeno 13. 9. 2026). Potřebná při navázání uprostřed souboru, kde už neprojde parserem. */
const RES_HEADER = ['ICO', 'OKRESLAU', 'DDATVZN', 'DDATZAN', 'ZPZAN', 'DDATPAKT', 'FORMA', 'ROSFORMA', 'KATPO', 'NACE', 'NACE2025', 'ICZUJ', 'FIRMA', 'CISS2010', 'KODADM', 'TEXTADR', 'PSC', 'OBEC_TEXT', 'COBCE_TEXT', 'ULICE_TEXT', 'TYPCDOM', 'CDOM', 'COR', 'DATPLAT', 'PRIZNAK'];

/**
 * Stažení po rozsazích, nekomprimované.
 *
 * Změřeno 14. 9. 2026: server ČSÚ posílá soubor gzipovaný, jakmile to klient dovolí (a `fetch`
 * to dovoluje sám), a ten proud po pár desítkách MB zamrzá — 41 MB za 8 minut, pak nic. Bez
 * komprese jede 4–5 MB/s. Proto `Accept-Encoding: identity` a soubor po kusech `RANGE_BYTES`
 * přes hlavičku Range (server ji podporuje): každý kus má vlastní limit času a tři pokusy,
 * takže jeden zaseklý požadavek nepoloží celý import.
 */
/** 16 MB: v produkci jde stažení ~0,8 MB/s, takže kus trvá ~20 s a hlídání času po kusu má smysl. */
const RANGE_BYTES = 16 * 1024 * 1024;
const RANGE_TIMEOUT_MS = 90_000;

/**
 * Jeden HTTP rozsah přes `node:https`, ne přes `fetch`.
 *
 * Změřeno 14. 9. 2026: `fetch` (undici) na tomhle serveru po dvou rozsazích zamrzne — třetí
 * a další požadavek neodpoví ani za 60 s, zatímco curl i `https.get` táž data stáhnou za
 * 12–30 s. Každý rozsah má vlastní spojení (`Connection: close`) a celý se načte do paměti,
 * aby se při chybě opakoval od začátku kusu a spotřebitel nedostal půlku dvakrát.
 */
function getRange(url: string, from: number, to: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'Accept-Encoding': 'identity', Range: `bytes=${from}-${to}`, Connection: 'close' },
      timeout: RANGE_TIMEOUT_MS,
    }, res => {
      if (res.statusCode !== 206) { res.resume(); reject(new Error(`ČSÚ RES: Range HTTP ${res.statusCode}`)); return; }
      const parts: Buffer[] = [];
      res.on('data', (c: Buffer) => parts.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(parts);
        if (buf.length !== to - from + 1) reject(new Error(`ČSÚ RES: kus ${from}-${to} má ${buf.length} B`));
        else resolve(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
      });
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('ČSÚ RES: timeout rozsahu')));
    req.on('error', reject);
  });
}

function headLength(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'HEAD', headers: { 'Accept-Encoding': 'identity', Connection: 'close' }, timeout: 30_000 }, res => {
      res.resume();
      const len = Number(res.headers['content-length']);
      if (res.statusCode !== 200 || !len) reject(new Error(`ČSÚ RES: HEAD HTTP ${res.statusCode}`));
      else resolve(len);
    });
    req.on('timeout', () => req.destroy(new Error('ČSÚ RES: timeout HEAD')));
    req.on('error', reject);
    req.end();
  });
}

async function* fetchInRanges(url: string, startByte = 0): AsyncGenerator<Uint8Array> {
  const total = await headLength(url);
  // Navázání uprostřed souboru: kus se rozřeže na řádky až od prvního konce řádku (viz `carry`
  // ve volajícím) — a řádky před kurzorem IČO se stejně přeskočí, takže začátek kusu nemusí
  // sedět na hranici řádku.
  for (let from = startByte; from < total; from += RANGE_BYTES) {
    const to = Math.min(from + RANGE_BYTES, total) - 1;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        yield await getRange(url, from, to);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        await new Promise(r => setTimeout(r, 1_000 * (attempt + 1)));
      }
    }
    if (lastErr) throw lastErr;
  }
}

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
  /** Začátek kusu dumpu (bajt), ve kterém proběhl poslední zápis — odtud navazuje další běh. */
  cursorByte: number | null;
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
  /** Bajt, od kterého stahovat (viz `ImportProgress.cursorByte`). */
  resumeByte?: number | null;
  /** Místo stažení z ČSÚ číst z tohoto streamu (lokální kopie dumpu při ladění). */
  input?: Readable;
  onProgress?: (p: ImportProgress) => Promise<void>;
}): Promise<ImportProgress> {
  const startedAt = new Date();
  const cutoff = cutoffDate(startedAt);
  // Webový proud z `fetch` se čte přímo přes `for await` — `Readable.fromWeb` se po zápisu
  // do databáze jednou zasekl (proces spal, žádná data, žádná chyba). Lokální soubor je Node
  // Readable, ten async iteraci umí taky.
  const startByte = opts.input ? 0 : Math.max(0, opts.resumeByte ?? 0);
  const stream: AsyncIterable<Buffer | Uint8Array | string> = opts.input ?? fetchInRanges(RES_URL, startByte);

  const progress: ImportProgress = { scanned: 0, kept: 0, cursorIco: opts.resumeFrom ?? null, cursorByte: startByte || null, done: false };
  /** Kde v souboru začíná právě zpracovávaný kus (pro `cursorByte`). */
  let chunkStart = startByte;
  let consumedBytes = startByte;
  let batch: Array<{ ico: string; foundedAt: Date; legalForm: string; nace: string | null; employeeCategory: string | null; district: string; municipality: number | null; registryUpdatedAt: Date | null; importedAt: Date }> = [];
  let skippingUntil = opts.resumeFrom ?? null;
  let stopped = false;

  /**
   * Zápis po `BATCH` řádcích, ať je kus textu jakkoli velký. V produkci chodí data po 48MB
   * rozsazích (~300 tisíc řádků), a první verze zapisovala celý kus naráz — Postgres odmítl
   * 165 385 vázaných proměnných v jednom dotazu (strop 32 767). Lokální soubor chodí po 64 KB,
   * tam se to neukázalo.
   */
  const flush = async () => {
    while (batch.length > 0) {
      const rows = batch.splice(0, BATCH);
      progress.cursorByte = chunkStart;
      // Nahradit, ne slučovat: řádek indexu je snímek registru, ne něco, co bychom sami doplňovali.
      await prisma.registrySubject.deleteMany({ where: { ico: { in: rows.map(r => r.ico) } } });
      await prisma.registrySubject.createMany({ data: rows, skipDuplicates: true });
      progress.kept += rows.length;
      progress.cursorIco = rows[rows.length - 1].ico;
      if (opts.onProgress) await opts.onProgress(progress);
    }
  };

  const consume = (r: ResRow) => {
    progress.scanned++;
    if (skippingUntil) {
      // Při navázání uprostřed souboru je první řádek kusu useknutý a jeho „IČO" je zbytek
      // jiného sloupce — takový řádek nesmí kurzor zrušit, jinak by se řádky před ním zapsaly znovu.
      if (!/^\d{1,8}$/.test(r.ICO) || r.ICO.padStart(8, '0') <= skippingUntil) return;
      skippingUntil = null;
    }
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
  };

  /**
   * Čtení po kusech přes `for await`, ne přes `step` + `pause()/resume()` knihovny.
   *
   * Původní verze pozastavovala parser při každém zápisu do databáze. Lokálně prošla, v produkci
   * (Node 24 na Vercelu) skončila na „Maximum call stack size exceeded" — obnovování proudu se
   * tam zanořovalo. Tady čtení brzdí samo `await` zápisu; kus textu se rozřeže na celé řádky
   * (neúplný poslední řádek se přenáší dál, lichý počet uvozovek znamená otevřené pole) a ty se
   * dají parseru jako hotový blok. Žádné zpětné volání, žádné zanoření.
   */
  const decoder = new TextDecoder('utf-8');
  let carry = '';
  /** Parita uvozovek na konci `carry`: 1 = jsme uvnitř pole s uvozovkami, které pokračuje. */
  let carryParity = 0;
  let header: string[] | null = startByte > 0 ? RES_HEADER : null;
  const parseBlock = (text: string) => {
    if (!text) return;
    const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true });
    for (const cells of parsed.data) {
      if (!header) { header = cells; continue; }
      const r = {} as Record<string, string>;
      header.forEach((h, i) => { r[h] = cells[i] ?? ''; });
      consume(r as unknown as ResRow);
    }
  };

  for await (const chunk of stream) {
    chunkStart = consumedBytes;
    consumedBytes += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
    const text = carry + (typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true }));
    // Řez jen na konci řádku, který není uvnitř pole s uvozovkami. Jedním průchodem: parita
    // uvozovek se počítá průběžně, ne opakovaným děleným řetězce — první verze tohle dělala
    // od konce po řádcích a na kusu s lichým počtem uvozovek se zacyklila do kvadratického času.
    let parity = carryParity;
    let cut = -1;
    for (let i = carry.length; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      if (ch === 34) parity ^= 1;
      else if (ch === 10 && parity === 0) cut = i;
    }
    if (cut < 0) { carry = text; carryParity = parity; continue; }
    parseBlock(text.slice(0, cut));
    carry = text.slice(cut + 1);
    carryParity = parity;
    if (batch.length >= BATCH) await flush();
    // Čas se hlídá po každém kusu, ne jen po zápisu: první stovky MB dumpu jsou starší firmy
    // mimo okno, takže se tam nezapisuje — a bez téhle kontroly funkce vypršela dřív, než
    // stihla říct, kde skončila. Další běh naváže od začátku dalšího kusu.
    if (Date.now() > opts.deadlineMs) {
      await flush();
      // Od začátku nedokončeného řádku, ne od dalšího kusu — jinak by ten jeden řádek propadl.
      progress.cursorByte = consumedBytes - Buffer.byteLength(carry);
      stopped = true;
      break;
    }
  }
  if (!stopped) {
    parseBlock(carry + decoder.decode());
    await flush();
  }
  // Při navázání uprostřed souboru je první řádek kusu useknutý: parser ho vezme jako
  // nesmysl s jiným počtem sloupců a `consume` ho zahodí přes chybějící datum vzniku. Hlavička
  // se při navázání neobjeví — proto se `header` doplní z konstantní podoby dumpu.

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
    progress.cursorByte = null;
  }
  return progress;
}

/** Kolik index zabírá a kolik má řádků — číslo, podle kterého se rozsah rozšiřuje. */
export async function registryIndexStats(): Promise<{ rows: number; bytes: number; oldest: Date | null; newest: Date | null }> {
  const [size] = await prisma.$queryRaw<Array<{ bytes: bigint }>>`SELECT pg_total_relation_size('"RegistrySubject"') AS bytes`;
  const agg = await prisma.registrySubject.aggregate({ _count: { ico: true }, _min: { foundedAt: true }, _max: { foundedAt: true } });
  return { rows: agg._count.ico, bytes: Number(size.bytes), oldest: agg._min.foundedAt, newest: agg._max.foundedAt };
}
