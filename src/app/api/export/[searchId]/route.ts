import { NextRequest, NextResponse } from 'next/server';
import { activeAccount, sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { exportToExcel, WEBSITE_LABEL_CS } from '@/lib/excel-export';
import { leadReason } from '@/lib/lead-reason';
import { reachScore } from '@/lib/reach-score';
import { resolveStatus } from '@/lib/website-status';

/**
 * Oddělovač sloupců. Excel v českém a slovenském Windows čte CSV podle systémového nastavení,
 * kde je desetinná čárka a oddělovač středník — s čárkou skončí všech osmnáct sloupců v jednom.
 */
const SEP = ';';

function toCsv(
  businesses: Parameters<typeof exportToExcel>[0],
  criteria?: readonly string[] | null,
): string {
  const headers = [
    'Název firmy', 'IČO', 'Telefon', 'Email', 'Adresa', 'Web',
    'Kontaktní stránka', 'Má web', 'Facebook', 'Instagram', 'LinkedIn', 'Sítě ověřeny',
    'Plátce DPH', 'Nespolehlivý plátce',
    'Skóre', 'Dosažitelnost', 'Proč oslovit',
    'Zdroj',
  ];

  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (s.includes(SEP) || s.includes(',') || s.includes('"') || s.includes('\n')) {
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
    // Odkaz, ne ANO/NE — export se otvírá proto, aby se na profil dalo kliknout.
    b.facebookUrl ?? '',
    b.instagramUrl ?? '',
    b.linkedInUrl ?? '',
    // Prázdno u odkazu znamená „nemá" i „nedívali jsme se". Tenhle sloupec ty dva stavy oddělí.
    b.socialsChecked ? 'ANO' : '',
    vat(b.vatPayer),
    vat(b.vatUnreliable),
    b.leadScore,
    // Druhé číslo vedle skóre: kolik cest k té firmě vlastně máme (viz lib/reach-score.ts).
    // V tabulce se podle něj dá seřadit a začít od těch, které jde oslovit hned.
    reachScore(b),
    leadReason(b, criteria, 'cs'),
    // Recenze a hodnocení pocházely jen z Google Places, které muselo pryč z licenčních důvodů.
    // Sloupce proto vyvážely samé nuly a prázdno — a nula recenzí je tvrzení, ne mezera.
    b.source,
  ].map(escape).join(SEP));

  return [headers.map(escape).join(SEP), ...rows].join('\r\n');
}

export async function GET(
  req: NextRequest,
  { params }: { params: { searchId: string } }
) {
  try {
    const payload = sessionFrom(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const format = req.nextUrl.searchParams.get('format') ?? 'xlsx';

    // CSV is free for everyone; Excel requires Pro+
    // Tarif z databáze, ne z tokenu: kdo právě zaplatil, má mít Excel hned, ne po odhlášení.
    const account = await activeAccount(payload.userId);
    if (!account) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (format === 'xlsx' && account.plan === 'FREE' && !account.isVip && !account.isAdmin) {
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

    /**
     * Název souboru s diakritikou.
     *
     * Hlavička HTTP unese jen znaky do 255, takže `filename="...ČR..."` shodilo celý export
     * výjimkou z Node — a export "Celá ČR" byl tedy vždycky pád, ne soubor. RFC 5987 na to
     * má dvojici: `filename` bez diakritiky pro staré klienty a `filename*` v UTF-8 pro
     * všechny dnešní prohlížeče.
     */
    const asciiSlug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\-]/g, '-');
    const disposition = (ext: string) =>
      `attachment; filename="klienthunter-${asciiSlug}.${ext}"; ` +
      `filename*=UTF-8''${encodeURIComponent(`klienthunter-${slug}.${ext}`)}`;

    if (format === 'csv') {
      // BOM: dvojklik v Excelu hlavičku Content-Type nevidí a bez něj čte soubor jako CP1250,
      // takže z „Květinářství Růže" je nečitelná změť. Ostatní tabulkové programy BOM snesou.
      const csv = `\uFEFF${toCsv(search.results, profile?.targetFilters)}`;
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': disposition('csv'),
        },
      });
    }

    const buffer = exportToExcel(search.results, 'klienthunter-export', profile?.targetFilters);
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': disposition('xlsx'),
      },
    });
  } catch (err) {
    console.error('/api/export/[searchId]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
