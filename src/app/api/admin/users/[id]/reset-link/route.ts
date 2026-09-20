import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'node:crypto';
import { activeAccount, sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Odkaz předává admin ručně (chat, telefon), proto delší platnost než hodina z e-mailu. */
const TTL_MIN = 24 * 60;

/**
 * Odkaz na nastavení nového hesla pro uživatele, vystavený adminem.
 *
 * Dokud není zapnutá pošta (chybí RESEND_API_KEY), formulář „zapomenuté heslo" nic neodešle.
 * Tohle je cesta, jak heslo obnovit i tak: admin si odkaz vygeneruje a pošle ho uživateli sám.
 * Token je stejný jako z e-mailu (jedno použití, v databázi jen otisk), takže /api/auth/reset
 * se nemění. Odkaz se vrací jen adminovi, nikam se neloguje.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = sessionFrom(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = await activeAccount(payload.userId);
    if (!me?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const user = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const locale = ['cs', 'sk', 'en'].includes(body?.locale) ? body.locale : 'cs';
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await prisma.passwordReset.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + TTL_MIN * 60 * 1000) },
    });
    const base = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    return NextResponse.json({ url: `${base}/${locale}/auth/reset?token=${token}`, expiresInMin: TTL_MIN });
  } catch (err) {
    console.error('/api/admin/users/[id]/reset-link:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
