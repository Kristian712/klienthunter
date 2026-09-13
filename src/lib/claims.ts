import { createHash } from 'node:crypto';
import { prisma } from './db';
import type { LiveAccount } from './auth';
import { CLAIM_TTL_DAYS, firmKeyOf, type ClaimMark } from './claim-order';

/**
 * Nároky na firmy — databázová část. Pravidla:
 *
 *  • Nárok zakládá **každý přihlášený účet** značkou contacted / talking / client. Free uživatel,
 *    který obvolá dvacet firem, po sobě musí nechat stopu, jinak je ochrana platících děravá.
 *  • Nárok se **aplikuje jen platícím** (PRO, BUSINESS, VIP, admin). Free účet cizí nárok nevidí
 *    a firmu dostane normálně — platí se za ochranu vlastního pořadí.
 *  • Zobrazení nárok nezakládá. Export také ne (viz komentář u modelu `Claim`).
 *  • Ukázka pro nepřihlášené a import CSV nároky nezakládají ani nečtou.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const CLAIM_STATUSES = new Set(['contacted', 'talking', 'client']);

export function isPaying(account: Pick<LiveAccount, 'plan' | 'isVip' | 'isAdmin'>): boolean {
  return account.plan === 'PRO' || account.plan === 'BUSINESS' || account.isVip || account.isAdmin;
}

/** Založí nebo obnoví nárok. Idempotentní: druhé označení jen posune čas. */
export async function recordClaim(userId: string, row: { ico?: string | null; placeId: string }): Promise<void> {
  const firmKey = firmKeyOf(row);
  await prisma.claim.upsert({
    where: { firmKey_userId: { firmKey, userId } },
    create: { firmKey, userId, source: 'tag' },
    update: { createdAt: new Date() },
  });
}

/**
 * Sůl pro míchání pořadí: hash userId, ne userId sám. Do prohlížeče jde jen tohle, a stejný
 * účet dostane pokaždé totéž.
 */
export function orderSalt(userId: string): string {
  return createHash('sha256').update(`kh-order:${userId}`).digest('hex').slice(0, 16);
}

/**
 * Označí řádky nároky. Jeden dotaz na celé hledání (až 500 klíčů, index na `firmKey, createdAt`),
 * žádné N+1. Vrací `'mine' | 'other' | null` — nikdy čí nárok to je ani kolik jich je.
 *
 * Neplatícímu účtu se databáze vůbec neptá: dostane samé `null`, tedy přesně dnešní chování.
 */
export async function markClaims<T extends { ico?: string | null; placeId: string }>(
  rows: T[],
  userId: string,
  paying: boolean,
): Promise<Array<T & { firmKey: string; claim: ClaimMark }>> {
  const keyed = rows.map(r => ({ ...r, firmKey: firmKeyOf(r), claim: null as ClaimMark }));
  if (!paying || keyed.length === 0) return keyed;

  const since = new Date(Date.now() - CLAIM_TTL_DAYS * DAY_MS);
  const claims = await prisma.claim.findMany({
    where: { firmKey: { in: Array.from(new Set(keyed.map(r => r.firmKey))) }, createdAt: { gt: since } },
    select: { firmKey: true, userId: true },
  });

  // Vlastní nárok vyhrává nad cizím: kdo firmu oslovil sám, vidí ji normálně.
  const marks = new Map<string, ClaimMark>();
  for (const c of claims) {
    const current = marks.get(c.firmKey);
    if (c.userId === userId) marks.set(c.firmKey, 'mine');
    else if (current !== 'mine') marks.set(c.firmKey, 'other');
  }
  for (const r of keyed) r.claim = marks.get(r.firmKey) ?? null;
  return keyed;
}
