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
 *  • Rezervace je jedna transakce pod zámkem (`pg_advisory_xact_lock`), takže ani dvacet firem
 *    ověřovaných najednou v několika instancích Vercelu strop nepřečerpá.
 *  • Brave účtuje jen úspěšné dotazy. Když vyhledávač neodpoví, rezervace se vrací.
 *  • Výchozí strop je 900, ne 1 000: ze stejného klíče jdou i dotazy z měřicích skriptů a z vývoje,
 *    které produkční databáze nevidí. `WEB_SEARCH_MONTHLY_LIMIT` ho umí snížit; výš než 1 000
 *    (celý kredit) se nepustí, ať je v proměnné cokoli.
 *
 * Když strop dojde, rezervace vrátí `null` a hledání pokračuje bez vyhledávače — firma dostane
 * „nevíme" místo „web nemá". Uživatel žádnou chybu nevidí; do logu se to zapíše jednou za běh.
 */

/** $5 kredit ÷ $5 za 1 000 dotazů. Nad tohle strop nikdy nepůjde. */
const CREDIT_QUERIES = 1_000;
const DEFAULT_LIMIT = 900;
export const QUOTA_WINDOW_DAYS = 31;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Libovolné pevné číslo zámku, sdílené všemi instancemi. */
const LOCK_KEY = 815203;

export function monthlyWebSearchLimit(): number {
  const raw = process.env.WEB_SEARCH_MONTHLY_LIMIT;
  const n = raw === undefined || raw.trim() === '' ? DEFAULT_LIMIT : Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), CREDIT_QUERIES);
}

/**
 * Zarezervuje jeden dotaz v měsíčním stropu. Vrací id rezervace, nebo `null`, když se ptát nesmí.
 * Nikdy nevyhodí výjimku: chyba databáze znamená „bez vyhledávače", ne spadlé hledání.
 */
export async function reserveWebSearch(): Promise<string | null> {
  const limit = monthlyWebSearchLimit();
  if (limit === 0) return null;
  try {
    return await prisma.$transaction(
      async tx => {
        await tx.$queryRawUnsafe(`SELECT 1 AS ok FROM pg_advisory_xact_lock(${LOCK_KEY})`);
        const now = Date.now();
        // Řádky, které z okna dávno vypadly, nikdo nepotřebuje. Index na `at` z toho dělá levný dotaz.
        await tx.webSearchCall.deleteMany({ where: { at: { lt: new Date(now - (QUOTA_WINDOW_DAYS + 10) * DAY_MS) } } });
        const used = await tx.webSearchCall.count({ where: { at: { gte: new Date(now - QUOTA_WINDOW_DAYS * DAY_MS) } } });
        if (used >= limit) return null;
        const row = await tx.webSearchCall.create({ data: {}, select: { id: true } });
        return row.id;
      },
      { timeout: 10_000 },
    );
  } catch (err) {
    console.error('web-search-quota: rezervace selhala, hledá se bez vyhledávače:', err);
    return null;
  }
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
 * jednou řekne ne, tahle kvóta se do konce běhu už na databázi neptá.
 */
export function createSearchQuota(perSearchBudget: number): CountingSearchQuota {
  let left = Math.max(0, Math.floor(perSearchBudget));
  let used = 0;
  let exhausted = false;
  return {
    async reserve() {
      if (exhausted || left <= 0) return null;
      left--;
      const ticket = await reserveWebSearch();
      if (!ticket) {
        left++;
        if (!exhausted) {
          exhausted = true;
          console.info('web-search-quota: měsíční strop dotazů je vyčerpaný, hledání pokračuje bez vyhledávače');
        }
        return null;
      }
      used++;
      return ticket;
    },
    async release(ticket) {
      left++;
      used--;
      await releaseWebSearch(ticket);
    },
    used: () => used,
  };
}
