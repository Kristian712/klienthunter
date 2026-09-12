import { NextRequest, NextResponse } from 'next/server';
import { activeAccount, sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { EXPORT_COLUMNS, exportRow, exportToExcel } from '@/lib/excel-export';
import { localized } from '@/lib/lead-filters';

/**
 * Oddělovač sloupců. Excel v českém a slovenském Windows čte CSV podle systémového nastavení,
 * kde je desetinná čárka a oddělovač středník — s čárkou skončí všech devatenáct sloupců v jednom.
 */
const SEP = ';';

/**
 * Excel, LibreOffice i Google Sheets vyhodnotí buňku začínající =, +, - nebo @ jako vzorec.
 * Názvy firem chodí z OpenStreetMap, kam může zapsat kdokoli cokoli, takže by stačilo pojmenovat
 * firmu `=HYPERLINK(…)` a každý, kdo si export otevře, by ten vzorec spustil. Apostrof před
 * hodnotou z ní udělá text; Excel ho v buňce nezobrazuje.
 */
function neutralize(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function toCsv(
  businesses: Parameters<typeof exportToExcel>[0],
  criteria: readonly string[] | null | undefined,
  locale: string,
): string {
  const escape = (v: unknown) => {
    const s = neutralize(v == null ? '' : String(v));
    if (s.includes(SEP) || s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  // Sloupce i hodnoty jsou tytez jako v XLSX (`EXPORT_COLUMNS`, `exportRow`), aby se oba exporty
  // nemohly rozejit v poradi ani v obsahu.
  const headers = EXPORT_COLUMNS.map(c => localized(c, locale));
  const rows = businesses.map(b => exportRow(b, criteria, locale).map(escape).join(SEP));

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
    // Jazyk souboru posílá stránka, ze které se kliklo. Bez něj chodil anglickému zákazníkovi
    // list s českými hlavičkami a českou větou „proč oslovit".
    const raw = req.nextUrl.searchParams.get('locale');
    const locale = raw === 'sk' || raw === 'en' ? raw : 'cs';

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
      const csv = `\uFEFF${toCsv(search.results, profile?.targetFilters, locale)}`;
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': disposition('csv'),
        },
      });
    }

    const buffer = exportToExcel(search.results, 'klienthunter-export', profile?.targetFilters, locale);
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
