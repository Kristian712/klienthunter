import { createHash } from 'node:crypto';
import { prisma } from './db';

/**
 * Limity pro požadavky, u kterých není přihlášený uživatel.
 *
 * Přihlášené hlídá `/api/search` samo: počítá řádky v tabulce Search, což je přesné a zadarmo,
 * protože ty řádky stejně vznikají. Anonymní ukázka žádné hledání neukládá — nemá ji k čemu
 * přiřadit — takže potřebuje vlastní počítadlo. A počítat se musí, protože jedno hledání spustí
 * dotaz do ARESu, dotaz na Overpass a stovky DNS i HTTP requestů na cizí weby. Nechat to bez
 * stropu by znamenalo dát komukoli tlačítko, kterým nám nechá zablokovat IP na Overpassu.
 */

/**
 * Identita návštěvníka bez účtu: SHA-256 ze soli a IP adresy.
 *
 * Sůl je serverová a nikdy neopouští backend, takže z uloženého hashe nejde IP odvodit hrubou
 * silou (bez soli by stačilo projít 4 miliardy IPv4 adres za pár minut). Ukládá se výhradně
 * hash — surová IP se nikam nezapisuje.
 *
 * I tak je to podle GDPR osobní údaj: pseudonymizace není anonymizace. Proto se záznamy mažou
 * po 24 hodinách a Ochrana údajů to popisuje.
 */
const SALT = process.env.IP_HASH_SALT || process.env.JWT_SECRET || '';

export function hashIp(req: Request & { ip?: string }): string {
  // Na Vercelu je klientská IP v `x-forwarded-for`; první položka je návštěvník, zbytek proxy.
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || req.headers.get('x-real-ip')?.trim() || req.ip || 'unknown';
  return createHash('sha256').update(`${SALT}:${ip}`).digest('hex');
}

/** Jak dlouho se záznam počítá — a zároveň jak dlouho vůbec existuje. */
export const ANONYMOUS_WINDOW_MS = 24 * 60 * 60 * 1000;

export type HitKind = 'search' | 'register';

/** Kolik požadavků daného druhu přišlo z téhle IP v okně. */
export async function countHits(ipHash: string, kind: HitKind): Promise<number> {
  return prisma.anonymousHit.count({
    where: { ipHash, kind, createdAt: { gte: new Date(Date.now() - ANONYMOUS_WINDOW_MS) } },
  });
}

/**
 * Zapíše požadavek a příležitostně uklidí staré záznamy.
 *
 * Úklid jede jen u zhruba každého dvacátého zápisu: cron kvůli mazání dvou set řádků denně
 * nestojí za to, a smazat je smí i běžný request. Chyba úklidu se ignoruje — je to údržba,
 * ne součást odpovědi uživateli.
 */
export async function recordHit(ipHash: string, kind: HitKind): Promise<void> {
  await prisma.anonymousHit.create({ data: { ipHash, kind } });
  if (Math.random() < 0.05) {
    await prisma.anonymousHit
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - ANONYMOUS_WINDOW_MS) } } })
      .catch(() => undefined);
  }
}

/** Kolik hledání smí anonym za okno, a kolik výsledků z nich uvidí. */
export const ANONYMOUS_SEARCHES = 1;
export const ANONYMOUS_RESULTS = 5;

/**
 * Kolik účtů smí vzniknout z jedné IP za 24 hodin.
 *
 * Registrace je otevřená a e-mail se neověřuje, takže bez tohohle by si kdokoli mohl zakládat
 * účty donekonečna a mít pokaždé dalších pět hledání zdarma. Pět je nad rámec toho, co udělá
 * domácnost nebo kancelář za jednou NAT adresou, a hluboko pod tím, co dává smysl farmit.
 */
export const REGISTRATIONS_PER_IP = 5;
