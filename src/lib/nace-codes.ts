import data from '@/data/nace-cz.json';

/**
 * Číselník CZ-NACE (2008) s českými názvy — 1 721 položek, pět úrovní (sekce A–U, oddíl 01–99,
 * skupina, třída, podtřída). Zdroj: ČSÚ, otevřená data, číselník `CZ_NACE_RES` (80004),
 * https://vdb.czso.cz/opendata/ciselniky/polozky?kod=CZ_NACE_RES, licence CC BY 4.0 (stejná
 * atribuce jako index — patička a stránka o zdrojích dat).
 *
 * Proč 2008 a ne 2025: ARES i RES dodávají kódy podle CZ-NACE 2008 (`czNace`, sloupec `NACE`);
 * nová klasifikace 2025 má v dumpu vlastní sloupec a přijde na řadu, až ji začne dávat ARES.
 *
 * K čemu: řádek výsledku říká „Činnosti reklamních agentur" místo „73110", a ve skládačce
 * jde obor vybrat podle kódu nebo názvu, když uživatel NACE zná.
 */
export interface NaceEntry {
  /** Kód: `A`, `73`, `731`, `7311`, `73110`. */
  c: string;
  /** Úroveň 1–5. */
  l: number;
  /** Český název. */
  n: string;
  /** Nadřazený kód, nebo null u sekce. */
  p: string | null;
}

export const NACE_CODES: NaceEntry[] = data as NaceEntry[];

const BY_CODE = new Map(NACE_CODES.map(e => [e.c, e]));

/** Název pro kód; když přesný kód není, zkusí nadřazené úrovně (`46900` → `4690` → `469`…). */
export function naceLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  let c = code.trim();
  while (c.length >= 2) {
    const hit = BY_CODE.get(c);
    if (hit) return hit.n;
    c = c.slice(0, -1);
  }
  return BY_CODE.get(c)?.n ?? null;
}

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Vyhledávání pro skládačku: podle kódu (prefix) nebo podle slova v názvu (bez diakritiky).
 * Vrací jen úrovně 2–5 — sekce (`A`) jsou moc hrubé na to, aby z nich vzniklo hledání.
 */
export function searchNace(query: string, limit = 30): NaceEntry[] {
  const q = fold(query.trim());
  if (!q) return [];
  const out: NaceEntry[] = [];
  const byCode = /^\d+$/.test(q);
  for (const e of NACE_CODES) {
    if (e.l < 2) continue;
    if (byCode ? e.c.startsWith(q) : fold(e.n).includes(q)) {
      out.push(e);
      if (out.length >= limit) break;
    }
  }
  return out;
}
