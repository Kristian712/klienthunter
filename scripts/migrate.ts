/**
 * Migrace databáze při buildu (rozhodnutí I-3, 15. 9. 2026).
 *
 * Do teď build volal `prisma db push --accept-data-loss` — každé nasazení smělo potichu smazat
 * sloupec i s daty a selhání se odchytilo přes `|| echo`, takže build prošel i s rozbitou
 * databází. Teď platí migrace v `prisma/migrations`: co se má v databázi změnit, je v gitu
 * jako SQL a nasazení bez něj neprojde.
 *
 * Produkce vznikla přes `db push`, takže tabulky už má, ale záznam o migracích ne. První běh
 * to pozná (tabulky ano, `_prisma_migrations` ne) a označí výchozí migraci `0_init` za
 * provedenou — nic nespouští, jen zapíše, že stav odpovídá. Prázdná databáze (nový projekt,
 * lokální vývoj) dostane `0_init` opravdu provedenou. Pak se nasadí, co ještě chybí.
 *
 * Nová změna schématu lokálně: `npm run db:migrate` (= `prisma migrate dev`), vzniklý adresář
 * v `prisma/migrations` jde do commitu.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const BASELINE = '0_init';

// Lokální spuštění (`npx tsx scripts/migrate.ts`) bez exportovaného prostředí: vezme se .env.
if (!process.env.DATABASE_URL) {
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue;
    const m = /^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m.exec(readFileSync(file, 'utf8'));
    if (m) { process.env.DATABASE_URL = m[1].trim(); break; }
  }
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const [row] = await prisma.$queryRaw<Array<{ migrations: string | null; users: string | null }>>`
      SELECT to_regclass('_prisma_migrations')::text AS migrations, to_regclass('"User"')::text AS users
    `;
    const hasTables = Boolean(row?.users);
    const hasHistory = Boolean(row?.migrations);
    if (hasTables && !hasHistory) {
      console.log(`migrate: databáze má tabulky, ale žádnou historii migrací — označuji ${BASELINE} za provedenou`);
      execSync(`npx prisma migrate resolve --applied ${BASELINE}`, { stdio: 'inherit' });
    }
    /**
     * Zombie zámek. Build, který Vercel zabil uprostřed migrace, nechal v Neonu spojení, které
     * drží advisory lock Prismy (72707369) — a každý další `migrate deploy` na něm vyprší
     * (P1002), i přes přímý host. Spojení téže role smíme ukončit sami; vlastní spojení se vynechá.
     */
    const killed = await prisma.$queryRaw<Array<{ pid: number }>>`
      SELECT l.pid, pg_terminate_backend(l.pid)
      FROM pg_locks l
      WHERE l.locktype = 'advisory' AND l.objid = 72707369 AND l.pid <> pg_backend_pid()
    `;
    if (killed.length) console.warn(`migrate: ukončeno ${killed.length} spojení, která držela zámek migrací`);
  } finally {
    await prisma.$disconnect();
  }
  /**
   * Migrace přes přímé spojení, ne přes pooler.
   *
   * 15. 9. 2026 spadly dva buildy na P1002: `migrate deploy` čeká na advisory lock
   * (`pg_advisory_lock`) a přes PgBouncer u Neonu (host `…-pooler…`) ho nedostane — pooler
   * vrací pokaždé jiné spojení. Přímý host je tentýž bez `-pooler`; když majitel nastaví
   * `DATABASE_URL_UNPOOLED`, má přednost. Aplikace sama dál používá pooler.
   */
  const direct = process.env.DATABASE_URL_UNPOOLED
    ?? process.env.DATABASE_URL?.replace(/(-pooler)(?=\.[a-z0-9-]+\.aws\.neon\.tech)/, '');
  const env = { ...process.env, ...(direct ? { DATABASE_URL: direct } : {}) };
  // Zámek může držet souběžný build (dvě nasazení za sebou) — pak se to za chvíli povede.
  for (let attempt = 1; ; attempt++) {
    try {
      execSync('npx prisma migrate deploy', { stdio: 'inherit', env });
      return;
    } catch (err) {
      if (attempt >= 3) throw err;
      console.warn(`migrate: pokus ${attempt} selhal, za 20 s znovu`);
      await new Promise(r => setTimeout(r, 20_000));
    }
  }
}

main().catch(err => {
  console.error('migrate:', err);
  process.exit(1);
});
