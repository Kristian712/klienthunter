/**
 * Lokální import indexu z ČSÚ — totéž, co dělá `POST /api/admin/import-res`, jen bez stropu funkce.
 *
 *   npx tsx scripts/import-res.ts            # stáhne dump z ČSÚ
 *   RES_FILE=/cesta/res_data.csv npx tsx scripts/import-res.ts   # lokální kopie
 *
 * Na konci vypíše počet řádků a velikost tabulky: podle toho se rozšiřuje `REGISTRY_INDEX_MONTHS`.
 */
import { createReadStream, existsSync } from 'node:fs';
import { prisma } from '../src/lib/db';
import { registryIndexStats, runRegistryImport } from '../src/lib/registry-index';

async function main() {
  const t0 = Date.now();
  const file = process.env.RES_FILE;
  if (file && !existsSync(file)) throw new Error(`RES_FILE neexistuje: ${file}`);
  const progress = await runRegistryImport({
    deadlineMs: Date.now() + 60 * 60 * 1000,
    input: file ? createReadStream(file) : undefined,
    onProgress: async p => { if (p.kept % 50_000 < 1_000) console.log(`  … přečteno ${p.scanned.toLocaleString('cs-CZ')}, v okně ${p.kept.toLocaleString('cs-CZ')}`); },
  });
  const stats = await registryIndexStats();
  console.log(`Hotovo za ${((Date.now() - t0) / 1000).toFixed(0)} s: přečteno ${progress.scanned.toLocaleString('cs-CZ')} řádků, v indexu ${stats.rows.toLocaleString('cs-CZ')}, tabulka ${(stats.bytes / 1024 / 1024).toFixed(1)} MB, vznik ${stats.oldest?.toISOString().slice(0, 10)} – ${stats.newest?.toISOString().slice(0, 10)}`);
}

main().catch(err => { console.error(err); process.exit(1); }).finally(() => prisma.$disconnect());
