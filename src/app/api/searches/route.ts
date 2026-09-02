import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Odpověď závisí na cookie, takže staticky se vykreslit nedá. Bez tohohle to Next zkusí při
 * buildu, dostane `Dynamic server usage` — a od chvíle, kdy `catch` chyby loguje, to při
 * každém buildu vypadá jako pád. Za běhu se nemění nic, jen se přestane zkoušet nemožné.
 */
export const dynamic = 'force-dynamic';

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
  } catch (err) {
    console.error('/api/searches:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
