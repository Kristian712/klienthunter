import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken } from '@/lib/auth';
import { searchInstagram } from '@/lib/instagram-scraper';

export const maxDuration = 60;

const Schema = z.object({ niche: z.string().min(1), location: z.string().default('') });

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    verifyToken(token);
    const { niche, location } = Schema.parse(await req.json());
    const result = await searchInstagram(niche, location);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 422 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
