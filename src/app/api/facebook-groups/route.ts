import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken } from '@/lib/auth';
import { scrapeFacebookGroup } from '@/lib/facebook-scraper';

export const maxDuration = 60;

const Schema = z.object({
  groupInput: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    verifyToken(token);

    const body = await req.json();
    const { groupInput } = Schema.parse(body);

    const result = await scrapeFacebookGroup(groupInput);

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 });
    }
    console.error('Facebook groups error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
