/**
 * Jednorázový (a opakovatelný) dopočet sloupce `BusinessResult.socialsChecked`.
 *
 * Proč vůbec existuje: sloupec přibyl až teď a má výchozí hodnotu `false`. Bez tohohle skriptu
 * by po nasazení všech 2 000+ starších řádků vypadalo jako „nikdo se nedíval“ — včetně těch,
 * u kterých jsme homepage prokazatelně stáhli a odkazy na sociální sítě z ní opravdu přečetli.
 * Aplikace by tím sice přestala lhát, ale zahodila by pravdivou informaci, kterou má.
 *
 * Co je důkaz, že se někdo díval:
 *  • `websiteMs IS NOT NULL` — tahle hodnota vzniká jen ve větvi `classify()`, která zároveň
 *    vrací `html`, a `analyzeBusinessFull()` běží právě a jen tehdy, když `html` dorazilo.
 *    Řádky zablokované přes robots.txt `websiteMs` nemají, takže správně zůstanou neoznačené.
 *  • některý z `facebookUrl` / `instagramUrl` / `linkedInUrl` je vyplněný — pak odpověď existuje
 *    bez ohledu na to, odkud přišla.
 *
 * Idempotentní: sahá jen na řádky, kde je `socialsChecked = false`. Pouští se z build scriptu,
 * takže na dalších deployích neudělá nic a stojí jeden dotaz.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const updated = await prisma.$executeRawUnsafe(`
    UPDATE "BusinessResult"
       SET "socialsChecked" = true
     WHERE "socialsChecked" = false
       AND ("websiteMs" IS NOT NULL
            OR "facebookUrl" IS NOT NULL
            OR "instagramUrl" IS NOT NULL
            OR "linkedInUrl" IS NOT NULL)
  `);
  console.log(`socialsChecked: doplněno u ${updated} řádků`);
} catch (err) {
  // Nikdy neshodit build kvůli dopočtu. Když se nepovede, řádky prostě zůstanou „neověřené“,
  // což je bezpečný stav — aplikace o nich mlčí, místo aby si vymýšlela.
  console.warn('socialsChecked: dopočet přeskočen —', String(err));
} finally {
  await prisma.$disconnect();
}
