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
import { PrismaClient } from '@prisma/client';

const BASELINE = '0_init';

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
  } finally {
    await prisma.$disconnect();
  }
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
}

main().catch(err => {
  console.error('migrate:', err);
  process.exit(1);
});
