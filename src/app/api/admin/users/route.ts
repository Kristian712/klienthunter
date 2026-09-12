import { NextRequest, NextResponse } from 'next/server';
import { activeAccount, sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';

/** Čte cookie, takže staticky se vykreslit nedá — viz `/api/searches`. */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const payload = sessionFrom(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Práva se čtou z databáze, ne z tokenu: odebraný admin by je jinak měl ještě sedm dní.
    const me = await activeAccount(payload.userId);
    if (!me?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
  } catch (err) {
    console.error('/api/admin/users:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
