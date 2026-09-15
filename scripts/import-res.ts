/**
 * Lokální import indexu z ČSÚ — totéž, co dělá `POST /api/admin/import-res`, jen bez stropu funkce.
 *
 *   npx tsx scripts/import-res.ts            # stáhne dump z ČSÚ
 *   RES_FILE=/cesta/res_data.csv npx tsx scripts/import-res.ts   # lokální kopie
 *
 * Na konci vypíše počet řádků a velikost tabulky: podle toho se rozšiřuje `REGISTRY_INDEX_MONTHS`.
 */
import { createReadStream, existsSync, readFileSync } from 'node:fs';

/**
 * Připojení k databázi z lokálního souboru, když v prostředí není.
 *
 * Produkční import: Vercel funkce má 300 s a ČSÚ po opakovaném stahování brzdí, takže se
 * index plní odsud — z počítače majitele, proti produkční databázi. Řetězec je jen v souboru
 * `.env.production.local` (v .gitignore přes `.env.*.local`), do gitu ani do logu nejde.
 * Načítá se dřív, než se importuje Prisma (ta čte `DATABASE_URL` při vzniku klienta).
 */
if (!process.env.DATABASE_URL) {
  for (const file of ['.env.production.local', '.env.local', '.env']) {
    if (!existsSync(file)) continue;
    const m = /^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m.exec(readFileSync(file, 'utf8'));
    if (m) { process.env.DATABASE_URL = m[1].trim(); console.log(`DATABASE_URL z ${file}`); break; }
  }
}

async function main() {
  const { prisma } = await import('../src/lib/db');
  const { registryIndexStats, runRegistryImport } = await import('../src/lib/registry-index');
  const host = (() => { try { return new URL(process.env.DATABASE_URL ?? '').host; } catch { return '?'; } })();
  console.log(`Databáze: ${host}`);
  // Záznam běhu jako z adminu, aby karta „Index firem" ukázala pravdu i po lokálním importu.
  const run = await prisma.registryImport.create({ data: {} });
  const t0 = Date.now();
  const file = process.env.RES_FILE;
  if (file && !existsSync(file)) throw new Error(`RES_FILE neexistuje: ${file}`);
  const progress = await runRegistryImport({
    deadlineMs: Date.now() + 60 * 60 * 1000,
    input: file ? createReadStream(file) : undefined,
    onProgress: async p => { if (p.kept % 50_000 < 1_000) console.log(`  … přečteno ${p.scanned.toLocaleString('cs-CZ')}, v okně ${p.kept.toLocaleString('cs-CZ')}`); },
  });
  const stats = await registryIndexStats();
  await prisma.registryImport.update({ where: { id: run.id }, data: { status: progress.done ? 'done' : 'running', finishedAt: progress.done ? new Date() : null, scanned: progress.scanned, kept: progress.kept, cursorIco: progress.cursorIco } });
  // Přerušené běhy z adminu, které by jinak blokovaly tlačítko dalších 10 minut.
  await prisma.registryImport.updateMany({ where: { status: 'running', id: { not: run.id } }, data: { status: 'failed', error: 'nahrazeno lokálním importem' } });
  console.log(`Hotovo za ${((Date.now() - t0) / 1000).toFixed(0)} s: přečteno ${progress.scanned.toLocaleString('cs-CZ')} řádků, v indexu ${stats.rows.toLocaleString('cs-CZ')}, tabulka ${(stats.bytes / 1024 / 1024).toFixed(1)} MB, vznik ${stats.oldest?.toISOString().slice(0, 10)} – ${stats.newest?.toISOString().slice(0, 10)}`);
}

main().catch(err => { console.error(err); process.exit(1); }).finally(async () => { const { prisma } = await import('../src/lib/db'); await prisma.$disconnect(); });
