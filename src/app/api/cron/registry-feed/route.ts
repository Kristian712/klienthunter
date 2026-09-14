import { NextRequest, NextResponse } from 'next/server';
import { activeAccount, sessionFrom } from '@/lib/auth';
import { registryFeedStatus, syncRegistryFeed } from '@/lib/registry-feed';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const HEADROOM_MS = 40_000;

/**
 * Denní synchronizace feedu ARESu (vercel.json: 4:30 UTC). Vercel posílá
 * `Authorization: Bearer <CRON_SECRET>`, pokud je proměnná nastavená — bez ní by route
 * mohl spustit kdokoli, proto se bez tajemství pustí jen přihlášený admin (tlačítko v adminu).
 */
async function authorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) return true;
  const payload = sessionFrom(req);
  if (!payload) return false;
  const me = await activeAccount(payload.userId);
  return Boolean(me?.isAdmin);
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const result = await syncRegistryFeed({ deadlineMs: Date.now() + maxDuration * 1000 - HEADROOM_MS });
    return NextResponse.json({ result, status: await registryFeedStatus() });
  } catch (err) {
    console.error('/api/cron/registry-feed:', err);
    return NextResponse.json({ error: 'Feed sync failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
