import { NextRequest, NextResponse } from 'next/server';
import { activeAccount, sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { REGISTRY_INDEX_MONTHS, registryIndexStats, runRegistryImport } from '@/lib/registry-index';

export const dynamic = 'force-dynamic';
/** Celých 300 s: stažení 543 MB dumpu a čtvrt milionu zápisů. Když to nestačí, běh naváže. */
export const maxDuration = 300;
const HEADROOM_MS = 30_000;

/** Stav indexu a posledního běhu — pro admina. */
export async function GET(req: NextRequest) {
  const payload = sessionFrom(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = await activeAccount(payload.userId);
  if (!me?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const [stats, last] = await Promise.all([
    registryIndexStats(),
    prisma.registryImport.findFirst({ orderBy: { startedAt: 'desc' } }),
  ]);
  return NextResponse.json({ months: REGISTRY_INDEX_MONTHS, stats, last });
}

/**
 * Spustí (nebo naváže) import. Majitel ho pouští ručně 2× měsíčně z adminu — produkční
 * `DATABASE_URL` je jen ve Vercelu, takže jediné místo, odkud jde importovat, je tahle funkce.
 * Souběžné běhy nejsou: dokud je jeden `running`, druhý se odmítne.
 */
export async function POST(req: NextRequest) {
  const payload = sessionFrom(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = await activeAccount(payload.userId);
  if (!me?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const running = await prisma.registryImport.findFirst({
    where: { status: 'running', startedAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
  });
  if (running) return NextResponse.json({ error: 'Import already running', code: 'RUNNING' }, { status: 409 });

  // Navázat na přerušený běh (vypršela funkce) místo začínání znovu.
  const interrupted = await prisma.registryImport.findFirst({
    where: { status: 'running', cursorIco: { not: null } },
    orderBy: { startedAt: 'desc' },
  });
  const run = await prisma.registryImport.create({ data: { cursorIco: interrupted?.cursorIco ?? null } });
  if (interrupted) await prisma.registryImport.update({ where: { id: interrupted.id }, data: { status: 'failed', error: 'timeout, navázáno' } });

  try {
    const progress = await runRegistryImport({
      deadlineMs: Date.now() + maxDuration * 1000 - HEADROOM_MS,
      resumeFrom: interrupted?.cursorIco ?? null,
      onProgress: async p => {
        await prisma.registryImport.update({ where: { id: run.id }, data: { scanned: p.scanned, kept: p.kept, cursorIco: p.cursorIco } });
      },
    });
    await prisma.registryImport.update({
      where: { id: run.id },
      data: { status: progress.done ? 'done' : 'running', finishedAt: progress.done ? new Date() : null, scanned: progress.scanned, kept: progress.kept, cursorIco: progress.cursorIco },
    });
    const stats = await registryIndexStats();
    return NextResponse.json({ progress, stats });
  } catch (err) {
    console.error('/api/admin/import-res:', err);
    await prisma.registryImport.update({ where: { id: run.id }, data: { status: 'failed', error: String(err).slice(0, 300) } }).catch(() => undefined);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
