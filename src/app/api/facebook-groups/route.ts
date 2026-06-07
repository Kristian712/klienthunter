import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken } from '@/lib/auth';
import { parseGroupHtml, parseGroupData, type ScrapeResult } from '@/lib/facebook-scraper';

export const maxDuration = 30;

const Schema = z.union([
  z.object({ html: z.string().min(100) }),
  z.object({ data: z.array(z.object({ name: z.string(), url: z.string(), count: z.number().optional() })) }),
]);

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    verifyToken(token);

    const body = await req.json();
    const parsed = Schema.parse(body);

    const result: ScrapeResult = 'data' in parsed
      ? await parseGroupData(parsed.data)
      : await parseGroupHtml(parsed.html);

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 });
    }
    console.error('Facebook groups error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
