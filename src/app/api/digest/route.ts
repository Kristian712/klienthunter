import { NextRequest, NextResponse } from 'next/server';
import { sessionFrom } from '@/lib/auth';
import { buildDigest, markDigestSeen } from '@/lib/digest';

export const dynamic = 'force-dynamic';

/** Karta „Nové firmy ve vašem kraji" na přehledu. Viz lib/digest.ts. */
export async function GET(req: NextRequest) {
  const payload = sessionFrom(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await buildDigest(payload.userId));
  } catch (err) {
    console.error('/api/digest:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Uživatel si kartu prohlédl — „nové od minule" se počítá od teď znovu. */
export async function PATCH(req: NextRequest) {
  const payload = sessionFrom(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await markDigestSeen(payload.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('/api/digest PATCH:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
