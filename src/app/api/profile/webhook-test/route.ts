import { NextRequest, NextResponse } from 'next/server';
import { sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { postWebhook } from '@/lib/webhook';

export const dynamic = 'force-dynamic';

/** Pošle na uloženou adresu testovací událost, ať si uživatel scénář v Make/Zapieru odladí bez hledání. */
export async function POST(req: NextRequest) {
  const payload = sessionFrom(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { webhookUrl: true, webhookSecret: true } });
  if (!user?.webhookUrl || !user.webhookSecret) return NextResponse.json({ error: 'No webhook', code: 'NO_WEBHOOK' }, { status: 422 });

  const result = await postWebhook(user.webhookUrl, user.webhookSecret, 'test', {
    count: 1,
    firms: [{
      id: 'test', name: 'Ukázková firma s.r.o.', ico: '00000000', phone: '+420 777 000 000', email: 'info@example.cz',
      website: 'https://example.cz', websiteStatus: 'HAS', address: 'Náměstí 1, 760 01 Zlín', category: '62010',
      foundedAt: new Date().toISOString(), vatPayer: false, score: 100,
      reason: 'Testovací událost z KlientHunteru.', websiteAudit: null, source: 'test',
    }],
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
