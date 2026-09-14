import axios from 'axios';
import { prisma } from './db';
import { REGISTRY_INDEX_MONTHS } from './registry-index-config';

/**
 * Denní dávky změn z ARESu (etapa 4) → index firem.
 *
 * Dump ČSÚ vychází dvakrát měsíčně a firmu má s odstupem: 6. 9. 2026 sahal ke vzniku 27. 8.
 * ARES ale každý den vydá dávku změn Registru osob (`ros`): kdo přibyl (INS), kdo se změnil
 * (UPD), kdo zanikl (DEL). Změřeno 14. 9. 2026: dávka 233 = 9 831 změn, z toho 76 INS a 15 DEL;
 * seznam vrací posledních 31 dávek. Z INS si dohledáme detail subjektu a zapíšeme ho do indexu
 * s `firstSeenAt` = datum dávky — to je ten údaj, který majitel chtěl: kdy jsme firmu poprvé
 * viděli. DEL řádek smaže. UPD se přeskakuje; opraví to příští dump.
 *
 * Co se ukládá: totéž co z dumpu (IČO, vznik, právní forma, NACE, kód kraje/obce). Okres ARES
 * nedává ve tvaru LAU 1, jen kraj — proto `district` nese jen NUTS 3 (`CZ072`); filtr hledá
 * `startsWith`, takže to funguje, a příští dump doplní okres. Žádná jména, žádné adresy.
 *
 * Limity: ARES 500 dotazů/min, Vercel funkce 300 s. Běh proto zpracuje jen tolik dávek, kolik
 * stihne do `deadlineMs`, a příště naváže — každá dávka je zapsaná až po dokončení.
 */
const BASE = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest';
const SOURCE = 'ros';
const CONCURRENCY = 8;
const MIN_GAP_MS = 130;
/** Při prvním běhu se bere jen tolik dní zpět — starší firmy má ČSÚ v dumpu. */
const FIRST_RUN_DAYS = 14;

/** ARES `sidlo.kodKraje` (číselník ČSÚ) → NUTS 3. Ověřeno na Zlínském kraji (141 → CZ072). */
const KRAJ_BY_CODE: Record<number, string> = {
  19: 'CZ010', 27: 'CZ020', 35: 'CZ031', 43: 'CZ032', 51: 'CZ041', 60: 'CZ042', 78: 'CZ051',
  86: 'CZ052', 94: 'CZ053', 108: 'CZ063', 116: 'CZ064', 124: 'CZ071', 132: 'CZ080', 141: 'CZ072',
};

interface Batch { cisloDavky: number; datovyZdroj: string; datumUvolneniDavky: string; pocetZmen: number }
interface Change { typZmeny: 'INS' | 'UPD' | 'DEL'; icoId: string }
interface Subject {
  ico?: string; datumVzniku?: string; datumZaniku?: string; pravniForma?: string; czNace?: string[];
  datumAktualizace?: string; sidlo?: { kodKraje?: number; kodObce?: number };
}

async function listBatches(): Promise<Batch[]> {
  const res = await axios.post(`${BASE}/ekonomicke-subjekty-notifikace/vyhledat`, { datovyZdroj: SOURCE, start: 0, pocet: 1000 }, { timeout: 15_000 });
  return (res.data?.notifikacniDavky ?? []) as Batch[];
}

async function fetchBatch(no: number): Promise<{ released: string; changes: Change[] }> {
  const res = await axios.get(`${BASE}/ekonomicke-subjekty-notifikace/datovy-zdroj/${SOURCE}/cislo-davky/${no}`, { timeout: 30_000 });
  return { released: res.data.datumUvolneniDavky, changes: (res.data.seznamNotifikaci ?? []) as Change[] };
}

async function fetchSubject(ico: string): Promise<Subject | null> {
  try {
    const res = await axios.get(`${BASE}/ekonomicke-subjekty/${ico}`, { timeout: 10_000, validateStatus: () => true });
    return res.status === 200 ? (res.data as Subject) : null;
  } catch {
    return null;
  }
}

/** Souběžnost pod limitem ARESu: osm pracovníků, každý dotaz nejmíň 130 ms × 8 od sebe. */
async function forEachLimited<T>(items: T[], fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      const started = Date.now();
      await fn(item);
      const wait = MIN_GAP_MS * CONCURRENCY - (Date.now() - started);
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
}

export interface FeedSyncResult {
  processed: number[];
  inserted: number;
  deleted: number;
  /** Dávky, na které v tomhle běhu nedošlo (čas). */
  pending: number;
  latestAvailable: number | null;
}

export async function syncRegistryFeed(opts: { deadlineMs: number }): Promise<FeedSyncResult> {
  const batches = (await listBatches()).sort((a, b) => a.cisloDavky - b.cisloDavky);
  const last = await prisma.registryFeedBatch.findFirst({ where: { source: SOURCE }, orderBy: { batchNo: 'desc' } });
  const firstRunSince = new Date(Date.now() - FIRST_RUN_DAYS * 24 * 60 * 60 * 1000);
  const todo = batches.filter(b => last ? b.cisloDavky > last.batchNo : new Date(b.datumUvolneniDavky) >= firstRunSince);
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - REGISTRY_INDEX_MONTHS);

  const result: FeedSyncResult = { processed: [], inserted: 0, deleted: 0, pending: 0, latestAvailable: batches.at(-1)?.cisloDavky ?? null };

  for (const b of todo) {
    if (Date.now() > opts.deadlineMs) { result.pending++; continue; }
    const { released, changes } = await fetchBatch(b.cisloDavky);
    const releasedAt = new Date(`${released}T00:00:00Z`);
    const ins = changes.filter(c => c.typZmeny === 'INS').map(c => c.icoId.padStart(8, '0'));
    const del = changes.filter(c => c.typZmeny === 'DEL').map(c => c.icoId.padStart(8, '0'));
    let inserted = 0;

    await forEachLimited(ins, async ico => {
      const s = await fetchSubject(ico);
      if (!s?.datumVzniku || s.datumZaniku) return;
      const founded = new Date(`${s.datumVzniku}T00:00:00Z`);
      if (Number.isNaN(founded.getTime()) || founded < cutoff) return;
      const district = s.sidlo?.kodKraje ? KRAJ_BY_CODE[s.sidlo.kodKraje] : undefined;
      if (!district) return; // bez kraje se firma v žádném hledání neobjeví — a cizí sídla do indexu nepatří
      const now = new Date();
      await prisma.registrySubject.upsert({
        where: { ico },
        create: {
          ico, foundedAt: founded, legalForm: s.pravniForma ?? '', nace: s.czNace?.[0] ?? null,
          employeeCategory: null, district, municipality: s.sidlo?.kodObce ?? null,
          registryUpdatedAt: s.datumAktualizace ? new Date(`${s.datumAktualizace}T00:00:00Z`) : null,
          importedAt: now, firstSeenAt: releasedAt,
        },
        // Už v indexu (z dumpu): jen doplnit, kdy jsme ji poprvé viděli, pokud to ještě nevíme.
        update: { firstSeenAt: releasedAt },
      });
      inserted++;
    });

    const removed = del.length ? await prisma.registrySubject.deleteMany({ where: { ico: { in: del } } }) : { count: 0 };

    await prisma.registryFeedBatch.upsert({
      where: { source_batchNo: { source: SOURCE, batchNo: b.cisloDavky } },
      create: { source: SOURCE, batchNo: b.cisloDavky, releasedAt, inserted, deleted: removed.count },
      update: { inserted, deleted: removed.count, processedAt: new Date() },
    });
    result.processed.push(b.cisloDavky);
    result.inserted += inserted;
    result.deleted += removed.count;
  }
  return result;
}

/** Stav pro admin: poslední zpracovaná dávka a kolik firem z feedu index nese. */
export async function registryFeedStatus() {
  const [last, fromFeed] = await Promise.all([
    prisma.registryFeedBatch.findFirst({ where: { source: SOURCE }, orderBy: { batchNo: 'desc' } }),
    prisma.registrySubject.count({ where: { firstSeenAt: { not: null } } }),
  ]);
  return { last, fromFeed };
}
