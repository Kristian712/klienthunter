import { randomUUID } from 'node:crypto';
import { prisma } from './db';
import type { SearchQuota } from './website-discovery';

/**
 * Tvrdý strop placených dotazů do vyhledávače (Brave Search API).
 *
 * Proč: Brave účtuje $5 za 1 000 dotazů a měsíčně dává kredit $5 (ověřeno 11. 9. 2026). Karta je
 * u účtu povinná a co přesáhne kredit, strhne se — strop útraty v dokumentaci nenabízí. Majitel
 * nechce platit nic, dokud nemá platícího zákazníka, takže jediná jistota je tenhle strop v kódu.
 *
 * Jak:
 *  • Každý dotaz je řádek ve `WebSearchCall`. Počítá se klouzavé okno **31 dní**: Brave neříká,
 *    jestli kredit obnovuje k začátku kalendářního měsíce, nebo k datu založení účtu, a žádné
 *    fakturační období není delší než 31 dní. Strop tedy platí pro jakékoli zarovnání.
 *  • Rezervace je jeden příkaz INSERT … WHERE count < strop (viz `reserveWebSearch`).
 *  • Brave účtuje jen úspěšné dotazy. Když vyhledávač neodpoví, rezervace se vrací.
 *  • Výchozí strop je pod kreditem (Brave 900 z 1 000, Linkup 3 500 z 4 000): ze stejného klíče
 *    jdou i dotazy z vývoje, které produkční databáze nevidí. `WEB_SEARCH_MONTHLY_LIMIT` ho umí
 *    snížit; výš než celý bezplatný kredit se nepustí, ať je v proměnné cokoli.
 *
 * Když strop dojde, rezervace vrátí `null` a hledání pokračuje bez vyhledávače — firma dostane
 * „nevíme" místo „web nemá". Uživatel žádnou chybu nevidí; do logu se to zapíše jednou za běh.
 */

/**
 * Strop = to, co pokryje bezplatný měsíční kredit, nikdy víc (majitel: „jestli se za zvednutí
 * platí, tak to nedělej", 1. 10. 2026).
 *  • Brave: $5 kredit ÷ $5 za 1 000 dotazů → 1 000, výchozí 900.
 *  • Linkup: dobití na $20 měsíčně ÷ $0,005 za dotaz → 4 000, výchozí 3 500 (rezerva na vývoj).
 */
const LINKUP = Boolean(process.env.LINKUP_API_KEY);
const CREDIT_QUERIES = LINKUP ? 4_000 : 1_000;
const DEFAULT_LIMIT = LINKUP ? 3_500 : 900;
export const QUOTA_WINDOW_DAYS = 31;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Kolik rezervací za sebou smí selhat na chybě databáze, než se vyhledávač pro běh vypne. */
const MAX_RESERVE_ERRORS = 8;

export function monthlyWebSearchLimit(): number {
  const raw = process.env.WEB_SEARCH_MONTHLY_LIMIT;
  const n = raw === undefined || raw.trim() === '' ? DEFAULT_LIMIT : Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), CREDIT_QUERIES);
}

/** Výsledek rezervace: lístek, vyčerpaný strop, nebo chyba databáze (to není totéž). */
export type Reservation = { id: string } | 'limit' | 'error';

/**
 * Zarezervuje jeden dotaz v měsíčním stropu. Nikdy nevyhodí výjimku.
 *
 * Jeden příkaz, žádná transakce se zámkem. Dřív tu byla interaktivní transakce s
 * `pg_advisory_xact_lock`; když dvacet firem ověřovaných naráz chtělo lístek, jedna z nich
 * narazila na timeout — a volající to četl jako „měsíční strop je vyčerpaný" a vypnul vyhledávač
 * do konce hledání. 11. 10. 2026 tak hledání v Královéhradeckém kraji položilo 8 dotazů z 200,
 * 417 firem zůstalo „neověřeno" a sekce Bez webu byla prázdná.
 *
 * Bez zámku může souběh strop přelézt o pár dotazů (nejvýš o počet souběžných firem) — strop je
 * schválně pod bezplatným kreditem, takže to nic nestojí.
 */
export async function reserveWebSearch(): Promise<Reservation> {
  const limit = monthlyWebSearchLimit();
  if (limit === 0) return 'limit';
  const id = randomUUID();
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "WebSearchCall" ("id", "at")
      SELECT ${id}, now()
      WHERE (
        SELECT count(*) FROM "WebSearchCall"
        WHERE "at" >= now() - (${QUOTA_WINDOW_DAYS} * interval '1 day')
      ) < ${limit}
      RETURNING "id"`;
    return rows.length > 0 ? { id } : 'limit';
  } catch (err) {
    console.error('web-search-quota: rezervace selhala:', err instanceof Error ? err.message : err);
    return 'error';
  }
}

/** Řádky dávno mimo okno nikdo nepotřebuje. Volá se jednou na hledání, ne u každého dotazu. */
export async function pruneWebSearchCalls(): Promise<void> {
  await prisma.webSearchCall
    .deleteMany({ where: { at: { lt: new Date(Date.now() - (QUOTA_WINDOW_DAYS + 10) * DAY_MS) } } })
    .catch(() => undefined);
}

/** Vyhledávač neodpověděl — Brave takový dotaz neúčtuje, rezervace se vrací do stropu. */
export async function releaseWebSearch(id: string): Promise<void> {
  await prisma.webSearchCall.delete({ where: { id } }).catch(() => undefined);
}

/** Kolik dotazů padlo za posledních 31 dní. Pro kontrolu, UI to nepotřebuje. */
export async function webSearchUsage(): Promise<{ used: number; limit: number; windowDays: number }> {
  const used = await prisma.webSearchCall.count({
    where: { at: { gte: new Date(Date.now() - QUOTA_WINDOW_DAYS * DAY_MS) } },
  });
  return { used, limit: monthlyWebSearchLimit(), windowDays: QUOTA_WINDOW_DAYS };
}

export interface CountingSearchQuota extends SearchQuota {
  /** Kolik dotazů tahle kvóta opravdu položila (po vrácení neúspěšných). */
  used(): number;
}

/**
 * Kvóta pro jedno hledání: nejdřív jeho vlastní strop (`perSearchBudget`), pak měsíční strop celé
 * aplikace.
 *
 * Vlastní strop se ubírá synchronně, dřív než se na cokoli čeká — dvacet firem ověřovaných
 * najednou by jinak všechny viděly „ještě zbývá" a strop hledání přečerpaly. Jakmile měsíční strop
 * jednou řekne ne, tahle kvóta se do konce běhu už na databázi neptá. Chyba databáze strop není:
 * vypne vyhledávač až po `MAX_RESERVE_ERRORS` selháních za sebou.
 */
export function createSearchQuota(perSearchBudget: number): CountingSearchQuota {
  let left = Math.max(0, Math.floor(perSearchBudget));
  let used = 0;
  let exhausted = false;
  let errors = 0;
  void pruneWebSearchCalls();
  return {
    async reserve() {
      if (exhausted || left <= 0) return null;
      left--;
      let ticket = await reserveWebSearch();
      // Chyba databáze není vyčerpaný strop: jeden pokus navíc, a když nevyjde, přijde o
      // vyhledávač jen tahle firma — ne celé hledání.
      if (ticket === 'error') ticket = await reserveWebSearch();
      if (ticket === 'error') {
        left++;
        if (++errors >= MAX_RESERVE_ERRORS && !exhausted) {
          exhausted = true;
          console.error('web-search-quota: rezervace opakovaně selhává, hledání pokračuje bez vyhledávače');
        }
        return null;
      }
      if (ticket === 'limit') {
        left++;
        if (!exhausted) {
          exhausted = true;
          console.info('web-search-quota: měsíční strop dotazů je vyčerpaný, hledání pokračuje bez vyhledávače');
        }
        return null;
      }
      errors = 0;
      used++;
      return ticket.id;
    },
    async release(ticket) {
      left++;
      used--;
      await releaseWebSearch(ticket);
    },
    used: () => used,
  };
}
