import { NextRequest, NextResponse } from 'next/server';
import { activeAccount, sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { lastMailError, mailTransport, sendMail } from '@/lib/mail';

export const dynamic = 'force-dynamic';

/**
 * Testovací e-mail adminovi na jeho vlastní adresu. Vrací výsledek i text chyby — bez toho se
 * „nepřišlo nic" řeší jen hádáním nad logem Vercelu (20. 9. 2026: Gmail zapnutý, e-mail nikde).
 */
export async function POST(req: NextRequest) {
  try {
    const payload = sessionFrom(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = await activeAccount(payload.userId);
    if (!me?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const admin = await prisma.user.findUnique({ where: { id: payload.userId }, select: { email: true } });
    if (!admin) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const started = Date.now();
    const result = await sendMail({
      to: admin.email,
      subject: 'Test pošty · KlientHunter',
      text: `Tohle je testovací e-mail z KlientHunteru (${new Date().toISOString()}). Když ho čtete, odesílání funguje.`,
    });
    return NextResponse.json({ result, transport: mailTransport(), error: result === 'failed' ? lastMailError() : null, ms: Date.now() - started, to: admin.email });
  } catch (err) {
    console.error('/api/admin/mail-test:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
