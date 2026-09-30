import axios from 'axios';

const BASE = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest';

/**
 * Převažující činnost firmy ze statistického registru (RES) — hromadně, sto IČO na dotaz.
 *
 * Proč: ARES hledá podle NACE mezi *všemi* deklarovanými činnostmi a firmy jich mívají deset
 * až dvacet. Změřeno 28. 9. 2026 na vzorcích po 100 firmách: ubytování v Liberci mělo jako
 * hlavní činnost jen 18 firem (zbytek divadlo, realitky, dopravci, pivovar), autoservis ve Zlíně
 * 29, instalatér v Olomouci 66. Majitel hledal vířivky a apartmány a dostal autolakovny.
 *
 * `POST /ekonomicke-subjekty-res/vyhledat` s `{ ico: [...] }` vrátí záznamy RES pro až sto
 * IČO za ~0,7 s — kontrola tedy stojí jeden dotaz na sto firem, ne sto dotazů. Záznam nese
 * `czNacePrevazujici` (CZ-NACE 2025) i `czNacePrevazujici2008` a mimochodem i kategorii
 * počtu pracovníků, takže pozdější dotaz na firmu (`ares-res.ts`) čte z téže paměti.
 */
export interface ResPrimary {
  /** CZ-NACE 2025, např. `96230`. */
  nace2025?: string;
  /** CZ-NACE 2008, např. `96040`. */
  nace2008?: string;
  employeeCategory?: string;
}

const BATCH = 100;
const TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; value: ResPrimary | null }>();

interface ResZaznam {
  ico?: string;
  primarniZaznam?: boolean;
  czNacePrevazujici?: string;
  czNacePrevazujici2008?: string;
  statistickeUdaje?: { kategoriePoctuPracovniku?: string };
}

/** Z paměti, bez sítě. `undefined` = neptali jsme se, `null` = RES firmu nezná. */
export function cachedResPrimary(ico: string): ResPrimary | null | undefined {
  const hit = cache.get(ico);
  return hit && Date.now() - hit.at < CACHE_TTL_MS ? hit.value : undefined;
}

/**
 * Převažující činnost pro seznam IČO. Vrací mapu jen pro IČO, na která RES odpověděl
 * (i odpovědí „nemám" → `null`). IČO z dávky, která selhala, v mapě chybí — volající tak pozná
 * „nevíme" od „firma v RES není".
 */
export async function fetchResPrimary(icos: string[], deadlineAt: number): Promise<Map<string, ResPrimary | null>> {
  const out = new Map<string, ResPrimary | null>();
  const todo: string[] = [];
  for (const ico of Array.from(new Set(icos))) {
    const hit = cachedResPrimary(ico);
    if (hit !== undefined) out.set(ico, hit);
    else todo.push(ico);
  }

  for (let i = 0; i < todo.length; i += BATCH) {
    if (Date.now() >= deadlineAt) break;
    const chunk = todo.slice(i, i + BATCH);
    try {
      const res = await axios.post(`${BASE}/ekonomicke-subjekty-res/vyhledat`, { ico: chunk, start: 0, pocet: chunk.length }, {
        timeout: TIMEOUT_MS,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        validateStatus: () => true,
      });
      if (res.status !== 200) continue;
      const found = new Map<string, ResPrimary>();
      for (const subject of res.data?.ekonomickeSubjekty ?? []) {
        const zaznamy: ResZaznam[] = subject?.zaznamy ?? [];
        const z = zaznamy.find(r => r.primarniZaznam) ?? zaznamy[0];
        if (!z?.ico) continue;
        found.set(z.ico, {
          nace2025: z.czNacePrevazujici || undefined,
          nace2008: z.czNacePrevazujici2008 || undefined,
          employeeCategory: z.statistickeUdaje?.kategoriePoctuPracovniku || undefined,
        });
      }
      const now = Date.now();
      for (const ico of chunk) {
        const value = found.get(ico) ?? null;
        cache.set(ico, { at: now, value });
        out.set(ico, value);
      }
    } catch (err) {
      console.warn('res-primary:', err instanceof Error ? err.message : err);
    }
  }
  return out;
}

/**
 * Sedí převažující činnost na obor? Kód z RES bývá v různé hloubce (`552`, `5590`, `55101`),
 * proto prefix oběma směry — kratší kód z RES ale aspoň tříznakový, jinak by `55` pustilo
 * i hotely do „kempů" a `4` celé stavebnictví.
 */
export function primaryMatches(primary: ResPrimary, codes: readonly string[], strict = false): boolean {
  // `strict`: jen přesná podtřída (`85591` jazykové školy). Kratší kód z RES („8559 ostatní
  // vzdělávání") by pustil kurzy čehokoli.
  return [primary.nace2025, primary.nace2008].some(p =>
    Boolean(p) && codes.some(c => p!.startsWith(c) || (!strict && p!.length >= 3 && c.startsWith(p!))),
  );
}
