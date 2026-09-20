import { NextRequest, NextResponse } from 'next/server';
import { activeAccount, sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Smazání účtu adminem (testovací účty, žádost o výmaz podle GDPR). Kaskády v Prismě smažou
 * hledání, výsledky, značky, relace i tokeny na obnovu hesla. Admina ani sebe smazat nejde —
 * to musí jít přes databázi vědomě, ne omylem z tabulky. Zákazník ve Stripe se tu nemaže
 * (bez klíče s právem mazat; prázdný zákazník nic nestojí).
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = sessionFrom(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = await activeAccount(payload.userId);
    if (!me?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (params.id === payload.userId) return NextResponse.json({ error: 'Cannot delete yourself', code: 'SELF' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, email: true, isAdmin: true } });
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (user.isAdmin) return NextResponse.json({ error: 'Cannot delete an admin', code: 'ADMIN' }, { status: 400 });

    await prisma.user.delete({ where: { id: user.id } });
    console.info(`admin/delete-user: ${user.email} smazán uživatelem ${payload.userId}`);
    return NextResponse.json({ ok: true, email: user.email });
  } catch (err) {
    console.error('/api/admin/users/[id]/delete:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
