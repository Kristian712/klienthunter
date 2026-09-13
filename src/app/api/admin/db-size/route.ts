import { NextRequest, NextResponse } from 'next/server';
import { activeAccount, sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Kolik místa databáze zabírá — pro admina, ne pro uživatele.
 *
 * Produkční `DATABASE_URL` je ve Vercelu označená jako Sensitive a nejde stáhnout ani přes
 * `vercel env pull`; majitel nemá účet u Neonu. Jediné místo, které se databáze umí zeptat,
 * je tedy běžící aplikace. Neon free plán má 0,5 GB na projekt a index z ČSÚ (etapa 3) se
 * má dimenzovat podle toho, kolik ho zbývá — tohle je to číslo.
 */
export async function GET(req: NextRequest) {
  const payload = sessionFrom(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = await activeAccount(payload.userId);
  if (!me?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const [total] = await prisma.$queryRaw<Array<{ bytes: bigint }>>`SELECT pg_database_size(current_database()) AS bytes`;
    const tables = await prisma.$queryRaw<Array<{ name: string; bytes: bigint; rows: bigint }>>`
      SELECT c.relname AS name, pg_total_relation_size(c.oid) AS bytes, s.n_live_tup AS rows
      FROM pg_class c JOIN pg_stat_user_tables s ON s.relid = c.oid
      ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 8`;
    return NextResponse.json({
      bytes: Number(total.bytes),
      tables: tables.map(t => ({ name: t.name, bytes: Number(t.bytes), rows: Number(t.rows) })),
    });
  } catch (err) {
    console.error('/api/admin/db-size:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
