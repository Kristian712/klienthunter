import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    const search = await prisma.search.findFirst({
      where: { id: params.id, userId: payload.userId },
    });

    if (!search) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter');

    const where: Record<string, unknown> = { searchId: params.id };
    if (filter === 'no_website') where.hasWebsite = false;
    if (filter === 'no_social') {
      where.hasFacebook = false;
      where.hasInstagram = false;
      where.hasLinkedIn = false;
    }
    if (filter === 'low_reviews') where.reviewCount = { lt: 10 };
    if (filter === 'low_rating') where.rating = { lt: 3.5 };

    const results = await prisma.businessResult.findMany({ where });
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
