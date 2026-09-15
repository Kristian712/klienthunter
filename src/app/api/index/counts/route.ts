import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NEW_FIRM_WINDOW_DAYS, normalizeFilters, registryWindowDays } from '@/lib/lead-filters';
import { isWholeCz, nuts3ForRegion } from '@/lib/regions-nuts';
import { indexWhere, naceCodesFor } from '@/lib/sources/registry';
import { isAllIndustries } from '@/lib/industries';

export const dynamic = 'force-dynamic';

const Body = z.object({
  region: z.string().min(1).max(120),
  industry: z.string().max(400).default('*'),
  filters: z.array(z.string().max(40)).max(50).default([]),
  districts: z.array(z.string().regex(/^CZ0[0-9A-C]{3}$/)).max(80).default([]),
});

/**
 * Počty z indexu ČSÚ pro skládačku — bez jediného dotazu do ARESu.
 *
 * Ke každé volbě ze skupiny „zužuje výběr" vrátí, kolik firem by jí odpovídalo při současném
 * nastavení ostatních voleb (fasety: u právní formy se nepočítá právní forma, u okresu okres…).
 * Filtry ze skupiny „prořezává nalezené" se tu záměrně nepočítají: jejich odpověď index nezná
 * a hádat ji by bylo přesně to, co majitel nechce.
 *
 * Bez okna podle vzniku se počítá s celým oknem indexu (`new_firm_5y`) — tak dlouhé okno index
 * má, a UI to říká. Kraj mimo index (Slovensko, cizina) vrací null.
 */
export async function POST(req: NextRequest) {
  const payload = sessionFrom(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const parsed = Body.parse(await req.json());
    const body = { ...parsed, filters: normalizeFilters(parsed.filters) };
    const nuts3 = nuts3ForRegion(body.region);
    // Celá ČR: index pokrývá celou republiku, počítá se bez omezení na kraj.
    if (!nuts3 && !isWholeCz(body.region)) return NextResponse.json({ counts: null });

    const windowDays = registryWindowDays(body.filters) ?? NEW_FIRM_WINDOW_DAYS.new_firm_5y;
    const all = isAllIndustries(body.industry);
    const codes = all ? [] : naceCodesFor(body.industry);
    const base = { nuts3, districts: body.districts, windowDays, codes, all: all || codes.length === 0 };
    const ids = new Set(body.filters);
    const without = (...drop: string[]) => Array.from(ids).filter(id => !drop.includes(id));
    const count = (filters: string[], extra: Partial<typeof base> = {}) =>
      prisma.registrySubject.count({ where: indexWhere({ ...base, ...extra, filters }) });

    const LEGAL = ['sole_trader', 'company_form'];
    const EMP = ['has_employees', 'no_employees'];
    const WIN = Object.keys(NEW_FIRM_WINDOW_DAYS);

    const [total, sole, company, empHas, empNone, empUnknown, ...windows] = await Promise.all([
      count(Array.from(ids)),
      count([...without(...LEGAL), 'sole_trader']),
      count([...without(...LEGAL), 'company_form']),
      count([...without(...EMP), 'has_employees']),
      count([...without(...EMP), 'no_employees']),
      prisma.registrySubject.count({ where: { ...indexWhere({ ...base, filters: without(...EMP) }), OR: [{ employeeCategory: null }, { employeeCategory: '000' }] } }),
      ...WIN.map(id => prisma.registrySubject.count({ where: indexWhere({ ...base, windowDays: NEW_FIRM_WINDOW_DAYS[id], filters: without(...WIN) }) })),
    ]);

    // Okresy: jeden group by přes celý kraj (bez omezení na vybrané okresy).
    const byDistrict = await prisma.registrySubject.groupBy({
      by: ['district'],
      where: indexWhere({ ...base, districts: [], filters: Array.from(ids) }),
      _count: { _all: true },
    });

    return NextResponse.json({
      counts: {
        total,
        windowDays,
        legal: { sole_trader: sole, company_form: company },
        employees: { has_employees: empHas, no_employees: empNone, unknown: empUnknown },
        windows: Object.fromEntries(WIN.map((id, i) => [id, windows[i]])),
        districts: Object.fromEntries(byDistrict.map(d => [d.district, d._count._all])),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 422 });
    console.error('/api/index/counts:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
