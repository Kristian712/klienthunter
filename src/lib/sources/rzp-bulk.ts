import axios from 'axios';
import type { RawLead } from './types';

const BASE = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest';

/**
 * Živnostenský rejstřík (RŽP) hromadně — sto IČO na dotaz (~0,3 s).
 *
 * K čemu: NACE neumí od sebe rozlišit obory, které si stát sloučil do jednoho kódu — kadeřnictví,
 * kosmetika, nehty a masáže mají v CZ-NACE 2025 všechny 96210, kavárny mají kód restaurací.
 * Živnostenský rejstřík je rozlišuje: „Holičství, kadeřnictví", „Kosmetické služby",
 * „Pedikúra, manikúra", „Masérské, rekondiční a regenerační služby", „Kominictví"… Změřeno
 * 30. 9. 2026: pod kódem 96210 v Přerově je vidět, kdo má manikúru a kdo kadeřnictví.
 *
 * Záznam se pamatuje, takže pozdější obohacení firmy (`ares-rzp.ts`) už nestahuje nic znovu.
 */
export interface RzpZivnost {
  predmetPodnikani?: unknown;
  druhZivnosti?: string;
  datumVzniku?: string;
  datumZaniku?: string;
  provozovny?: Array<{ sidloProvozovny?: { textovaAdresa?: string } }>;
}

export interface RzpZaznam {
  ico?: string;
  primarniZaznam?: boolean;
  zivnosti?: RzpZivnost[];
  provozovnyStav?: { pocetAktivnich?: number };
}

const BATCH = 100;
const TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; value: RzpZaznam | null }>();

/** Z paměti. `undefined` = neptali jsme se, `null` = v RŽP firma není (např. lékař, advokát). */
export function cachedRzp(ico: string): RzpZaznam | null | undefined {
  const hit = cache.get(ico);
  return hit && Date.now() - hit.at < CACHE_TTL_MS ? hit.value : undefined;
}

export function rememberRzp(ico: string, value: RzpZaznam | null): void {
  cache.set(ico, { at: Date.now(), value });
}

/** Mapa jen pro IČO, na která RŽP odpověděl; IČO ze selhané dávky chybí (= nevíme). */
export async function fetchRzp(icos: string[], deadlineAt: number): Promise<Map<string, RzpZaznam | null>> {
  const out = new Map<string, RzpZaznam | null>();
  const todo: string[] = [];
  for (const ico of Array.from(new Set(icos))) {
    const hit = cachedRzp(ico);
    if (hit !== undefined) out.set(ico, hit);
    else todo.push(ico);
  }
  for (let i = 0; i < todo.length; i += BATCH) {
    if (Date.now() >= deadlineAt) break;
    const chunk = todo.slice(i, i + BATCH);
    try {
      const res = await axios.post(`${BASE}/ekonomicke-subjekty-rzp/vyhledat`, { ico: chunk, start: 0, pocet: chunk.length }, {
        timeout: TIMEOUT_MS,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        validateStatus: () => true,
      });
      if (res.status !== 200) continue;
      const found = new Map<string, RzpZaznam>();
      for (const subject of res.data?.ekonomickeSubjekty ?? []) {
        const zaznamy: RzpZaznam[] = subject?.zaznamy ?? [];
        const z = zaznamy.find(r => r.primarniZaznam) ?? zaznamy[0];
        if (z?.ico) found.set(z.ico, z);
      }
      for (const ico of chunk) {
        const value = found.get(ico) ?? null;
        rememberRzp(ico, value);
        out.set(ico, value);
      }
    } catch (err) {
      console.warn('rzp-bulk:', err instanceof Error ? err.message : err);
    }
  }
  return out;
}

/** Předměty podnikání živností, které platí (bez data zániku). */
export function activeLicences(z: RzpZaznam | null | undefined): string[] {
  return (z?.zivnosti ?? [])
    .filter(t => !t.datumZaniku)
    .map(t => (typeof t.predmetPodnikani === 'string' ? t.predmetPodnikani : ''))
    .filter(Boolean);
}

/** Co z RŽP přebírá řádek: adresa provozovny, počet aktivních provozoven, živnosti. */
export function patchFromRzp(z: RzpZaznam | null): Partial<RawLead> {
  if (!z) return {};
  const trades = z.zivnosti ?? [];
  const premises = trades.flatMap(t => t.provozovny ?? []);
  /**
   * Kolik provozoven firmě běží. Bereme hotové počítadlo z odpovědi, ne `premises.length` —
   * to by lhalo, protože `provozovny` visí pod každou živností zvlášť a jedna provozovna se
   * tak v seznamu opakuje tolikrát, kolik má firma živností.
   */
  const activePremises = typeof z.provozovnyStav?.pocetAktivnich === 'number' ? z.provozovnyStav.pocetAktivnich : 0;
  const licences = trades.map(t => ({
    kind: t.druhZivnosti,
    subject: typeof t.predmetPodnikani === 'string' ? t.predmetPodnikani : undefined,
    since: t.datumVzniku,
  })).filter(t => t.kind || t.subject || t.since);
  // Adresa provozovny (dílna, salon) je lepší než sídlo — u živnostníka to bývá byt.
  const address = premises[0]?.sidloProvozovny?.textovaAdresa;
  return { ...(address ? { address } : {}), activePremises, ...(licences.length ? { trades: licences } : {}) };
}
