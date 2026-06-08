import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { exportToExcel } from '@/lib/excel-export';

function toCsv(businesses: Parameters<typeof exportToExcel>[0]): string {
  const headers = [
    'Název firmy', 'Telefon', 'Email', 'Adresa', 'Web',
    'Má web', 'Facebook', 'Instagram', 'LinkedIn',
    'Recenze', 'Hodnocení', 'Google Maps', 'Zdroj',
  ];

  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = businesses.map(b => [
    b.name,
    b.phone ?? '',
    b.email ?? '',
    b.address ?? '',
    b.website ?? '',
    b.hasWebsite ? 'ANO' : 'NE',
    b.hasFacebook ? 'ANO' : 'NE',
    b.hasInstagram ? 'ANO' : 'NE',
    b.hasLinkedIn ? 'ANO' : 'NE',
    b.reviewCount,
    b.rating ?? '',
    b.googleMapsUrl ?? '',
    (b as any).source ?? 'google',
  ].map(escape).join(','));

  return [headers.map(escape).join(','), ...rows].join('\n');
}

export async function GET(
  req: NextRequest,
  { params }: { params: { searchId: string } }
) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    const format = req.nextUrl.searchParams.get('format') ?? 'xlsx';

    // CSV is free for everyone; Excel requires Pro+
    if (format === 'xlsx' && payload.plan === 'FREE' && !payload.isVip && !payload.isAdmin) {
      return NextResponse.json({ error: 'Excel export requires Pro plan' }, { status: 403 });
    }

    const search = await prisma.search.findFirst({
      where: { id: params.searchId, userId: payload.userId },
      include: { results: true },
    });

    if (!search) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const slug = `${search.region}-${search.query}`.replace(/[^a-z0-9áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ\-]/gi, '-').slice(0, 60);

    if (format === 'csv') {
      const csv = toCsv(search.results);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="klienthunter-${slug}.csv"`,
        },
      });
    }

    const buffer = exportToExcel(search.results);
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="klienthunter-${slug}.xlsx"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
