import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (payload.userId === params.id) return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });

    const { blocked } = await req.json();

    const user = await prisma.user.update({
      where: { id: params.id },
      data: { accessExpiresAt: blocked ? new Date(0) : null },
      select: { id: true, email: true, name: true, plan: true, isAdmin: true, isVip: true, accessExpiresAt: true },
    });

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
