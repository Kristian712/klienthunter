import { NextRequest, NextResponse } from 'next/server';
import { confirmOptout } from '@/lib/optout';

export const dynamic = 'force-dynamic';

/** Odkaz z potvrzovacího e-mailu. Vyřazení platilo už od žádosti; tohle jen zvýší jeho váhu. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  const ok = token.length >= 16 && (await confirmOptout(token).catch(err => { console.error('/api/optout/confirm:', err); return false; }));
  const base = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  return NextResponse.redirect(`${base}/cs/optout?${ok ? 'confirmed=1' : 'invalid=1'}`);
}
