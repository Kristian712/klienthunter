import { NextRequest, NextResponse } from 'next/server';
import { activeAccount, sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = sessionFrom(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = await activeAccount(payload.userId);
    if (!me?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // Prevent self-demotion
    if (params.id === payload.userId) {
      return NextResponse.json({ error: 'Cannot change your own admin status' }, { status: 400 });
    }

    const { isAdmin } = await req.json();

    const user = await prisma.user.update({
      where: { id: params.id },
      data: { isAdmin: Boolean(isAdmin) },
      select: { id: true, email: true, name: true, plan: true, isAdmin: true, isVip: true },
    });

    return NextResponse.json({ user });
  } catch (err) {
    console.error('/api/admin/users/[id]/admin:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
