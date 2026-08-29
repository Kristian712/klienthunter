import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { exportToExcel, socialLabel, WEBSITE_LABEL_CS } from '@/lib/excel-export';
import { leadReason } from '@/lib/lead-reason';
import { resolveStatus } from '@/lib/website-status';

function toCsv(
  businesses: Parameters<typeof exportToExcel>[0],
  criteria?: readonly string[] | null,
): string {
  const headers = [
    'Název firmy', 'IČO', 'Telefon', 'Email', 'Adresa', 'Web',
    'Kontaktní stránka', 'Má web', 'Facebook', 'Instagram', 'LinkedIn',
    'Plátce DPH', 'Nespolehlivý plátce',
    'Skóre', 'Proč oslovit',
    'Zdroj',
  ];

  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  // NULL means the register was never asked — an empty cell, not a "NE".
  const vat = (value: boolean | null | undefined) => (value == null ? '' : value ? 'ANO' : 'NE');

  const rows = businesses.map(b => [
    b.name,
    b.ico ?? '',
    b.phone ?? '',
    b.email ?? '',
    b.address ?? '',
    b.website ?? '',
    b.contactUrl ?? '',
    WEBSITE_LABEL_CS[resolveStatus(b)],
    // Empty, not "NE", on a row where nobody ever looked — see `socialLabel`.
    socialLabel(b.hasFacebook, b.socialsChecked),
    socialLabel(b.hasInstagram, b.socialsChecked),
    socialLabel(b.hasLinkedIn, b.socialsChecked),
    vat(b.vatPayer),
    vat(b.vatUnreliable),
    b.leadScore,
    leadReason(b, criteria, 'cs'),
    // Recenze a hodnocení pocházely jen z Google Places, které muselo pryč z licenčních důvodů.
    // Sloupce proto vyvážely samé nuly a prázdno — a nula recenzí je tvrzení, ne mezera.
    b.source,
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

    // Věta „proč oslovit" se počítá ze stejných kritérií jako skóre uložené v řádku, takže
    // export a obrazovka vysvětlují pořadí stejně. Profil bereme aktuální — kdyby si uživatel
    // kritéria mezitím změnil, dostane vysvětlení podle toho, co ho zajímá teď.
    const profile = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { targetFilters: true },
    });

    const slug = `${search.region}-${search.query}`.replace(/[^a-z0-9áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ\-]/gi, '-').slice(0, 60);

    if (format === 'csv') {
      const csv = toCsv(search.results, profile?.targetFilters);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="klienthunter-${slug}.csv"`,
        },
      });
    }

    const buffer = exportToExcel(search.results, 'klienthunter-export', profile?.targetFilters);
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
