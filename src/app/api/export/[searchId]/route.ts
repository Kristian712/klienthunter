import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { exportToExcel } from '@/lib/excel-export';

export async function GET(
  req: NextRequest,
  { params }: { params: { searchId: string } }
) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (payload.plan === 'FREE') {
      return NextResponse.json({ error: 'Excel export requires Pro plan' }, { status: 403 });
    }

    const search = await prisma.search.findFirst({
      where: { id: params.searchId, userId: payload.userId },
      include: { results: true },
    });

    if (!search) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const buffer = exportToExcel(search.results);

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="klienthunter-${search.region}-${search.query}.xlsx"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
