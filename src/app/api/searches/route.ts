import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    const searches = await prisma.search.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { results: true } } },
    });

    return NextResponse.json({ searches });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
