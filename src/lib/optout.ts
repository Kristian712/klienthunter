import { randomBytes } from 'node:crypto';
import { prisma } from './db';
import { sendMail } from './mail';
import { firmKeyOf } from './claim-order';

/**
 * Trvalé vyřazení subjektu na jeho žádost.
 *
 * Pořadí je záměrně „nejdřív vyřadit, pak ověřit": žádost zapíše řádek se stavem `active` a od
 * té chvíle subjekt nikdo nevidí — nezapíše se do nového hledání (`persistResults`), zmizí ze
 * čtení uložených hledání i z exportu. Ověření (klik na odkaz z e-mailu, kontrola v adminu)
 * přijde potom; neplatná žádost se označí `rejected` a subjekt se vrátí. Kdyby se čekalo na
 * schválení, žádost by visela, dokud by si ji někdo nepřečetl, a to se u námitky nedělá.
 *
 * Klíč je stejný jako u nároků (`firmKeyOf`): IČO, jinak `osm:<placeId>`. Formulář přijímá jen IČO.
 */

export const OPTOUT_ACTIVE = ['active', 'confirmed'] as const;

/** Normalizované IČO (8 číslic, s nulami zleva) nebo null. */
export function normalizeIco(raw: string): string | null {
  const digits = raw.replace(/\s+/g, '');
  if (!/^\d{1,8}$/.test(digits)) return null;
  return digits.padStart(8, '0');
}

/** Klíče, které jsou právě vyřazené — jeden dotaz na celou dávku, žádné N+1. */
export async function activeOptoutKeys(keys: string[]): Promise<Set<string>> {
  const unique = Array.from(new Set(keys.filter(Boolean)));
  if (unique.length === 0) return new Set();
  const rows = await prisma.optout.findMany({
    where: { firmKey: { in: unique }, status: { in: [...OPTOUT_ACTIVE] } },
    select: { firmKey: true },
  });
  return new Set(rows.map(r => r.firmKey));
}

/** Odfiltruje vyřazené řádky. Používají to čtecí routy i export. */
export async function withoutOptouts<T extends { ico?: string | null; placeId: string }>(rows: T[]): Promise<T[]> {
  const blocked = await activeOptoutKeys(rows.map(firmKeyOf));
  return blocked.size === 0 ? rows : rows.filter(r => !blocked.has(firmKeyOf(r)));
}

/**
 * Založí žádost. Idempotentní: druhá žádost na totéž IČO jen obnoví e-mail a token, vyřazení
 * platí dál. Vrací token pro potvrzovací odkaz.
 */
export async function requestOptout(ico: string, email: string | null): Promise<{ token: string; created: boolean }> {
  const token = randomBytes(24).toString('base64url');
  const existing = await prisma.optout.findUnique({ where: { firmKey: ico }, select: { id: true, status: true } });
  if (existing) {
    // Zamítnutou žádost nová žádost znovu aktivuje — třeba se napoprvé spletl v e-mailu.
    await prisma.optout.update({
      where: { firmKey: ico },
      data: { email, token, status: 'active', confirmedAt: null, reviewedAt: null },
    });
    return { token, created: false };
  }
  await prisma.optout.create({ data: { firmKey: ico, email, token, status: 'active' } });
  return { token, created: true };
}

/** Potvrzení z e-mailu. Vrací false pro neznámý token. */
export async function confirmOptout(token: string): Promise<boolean> {
  const row = await prisma.optout.findUnique({ where: { token }, select: { id: true, status: true } });
  if (!row) return false;
  if (row.status === 'active') {
    await prisma.optout.update({ where: { id: row.id }, data: { status: 'confirmed', confirmedAt: new Date() } });
  }
  return true;
}

/**
 * Potvrzovací e-mail přes společnou poštovní službu (lib/mail.ts, od 15. 9. 2026).
 *
 * Vyřazení platí od okamžiku žádosti a žádné potvrzení nepotřebuje — e-mail je jen zdvořilost
 * a možnost, jak si žadatel ověří, že jsme žádost přijali. Stránka o odeslání nic neslibuje,
 * a když pošta není zapnutá nebo selže, nic se nestane a nic se netvrdí.
 */
export async function sendOptoutMail(email: string, confirmUrl: string): Promise<'sent' | 'disabled' | 'failed'> {
  return sendMail({
    to: email,
    subject: 'Vyřazení ze seznamu · KlientHunter',
    text: `Dobrý den,\n\npřijali jsme žádost o trvalé vyřazení subjektu z aplikace KlientHunter. Vyřazení platí od této chvíle — subjekt se v aplikaci nezobrazuje, nezapisuje se do nových hledání a neexportuje.\n\nPokud chcete žádost potvrdit i pro naši evidenci, klikněte na odkaz (není to nutné):\n\n${confirmUrl}\n\nKlientHunter`,
  });
}
