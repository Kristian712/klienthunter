import { NextRequest, NextResponse } from 'next/server';
import { searchNace } from '@/lib/nace-codes';

export const dynamic = 'force-dynamic';

/**
 * Našeptávač CZ-NACE pro skládačku. Na serveru schválně: číselník má 140 KB a do prohlížeče
 * nemá co chodit kvůli jednomu poli.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ items: [] });
  return NextResponse.json({ items: searchNace(q, 25).map(e => ({ code: e.c, name: e.n, level: e.l })) });
}
