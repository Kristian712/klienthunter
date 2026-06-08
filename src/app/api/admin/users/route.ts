import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const users = await prisma.user.findMany({
      select: {
        id: true, email: true, name: true,
        plan: true, isAdmin: true, isVip: true,
        accessExpiresAt: true, createdAt: true,
        _count: { select: { searches: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
