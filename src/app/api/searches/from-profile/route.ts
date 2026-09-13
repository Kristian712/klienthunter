import { NextRequest, NextResponse } from 'next/server';
import { sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { localized } from '@/lib/lead-filters';
import { industriesFor, presetFiltersFor, professionById } from '@/lib/profile';
import { SCENARIO_BY_PROFESSION } from '@/lib/scenarios';
import { industryLabel } from '@/lib/search-options';

export const dynamic = 'force-dynamic';

/**
 * První uložené hledání z dotazníku po registraci.
 *
 * Jen se **uloží**, nespustí: spuštění je uživatelovo rozhodnutí a stojí dotazy do rejstříků —
 * registrace sama nemá žrát limit. Kdo dotazník přeskočil, tuhle routu nikdy nezavolá a přehled
 * má prázdný. `origin = 'profile'` říká UI, že je to výchozí kombinace podle oboru, ne něco daného;
 * první úprava ji přepne na `user` (viz PATCH /api/searches/[id]).
 *
 * Idempotentní: druhé volání (opakované vyplnění dotazníku) existující kombinaci z profilu jen
 * aktualizuje, pokud ji uživatel ještě neupravil. Tu, kterou už udělal svou, nechá být.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = sessionFrom(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const locale = (() => { const l = req.nextUrl.searchParams.get('locale'); return l === 'sk' || l === 'en' ? l : 'cs'; })();

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { profession: true, clientType: true, targetIndustry: true, targetRegion: true },
    });
    const profession = professionById(user?.profession);
    if (!user || !profession) return NextResponse.json({ error: 'No profile', code: 'NO_PROFILE' }, { status: 422 });

    const answer = { profession: user.profession, clientType: user.clientType };
    const filters = presetFiltersFor(answer);
    const scenario = SCENARIO_BY_PROFESSION[profession.id] ?? 'all';
    const query = user.targetIndustry || industriesFor(answer)[0] || 'restaurant';
    const region = user.targetRegion || 'Celá ČR';
    const regionShort = region.split(',')[0].trim();
    const name = `${industryLabel(query, locale)} · ${regionShort}`;

    const existing = await prisma.search.findFirst({
      where: { userId: payload.userId, origin: 'profile', name: { not: null } },
      select: { id: true },
    });
    const search = existing
      ? await prisma.search.update({ where: { id: existing.id }, data: { name, query, region, filters, scenario }, select: { id: true, name: true } })
      : await prisma.search.create({
          data: { userId: payload.userId, query, region, name, filters, scenario, origin: 'profile' },
          select: { id: true, name: true },
        });

    return NextResponse.json({ search, note: localized({ cs: 'uloženo, nespuštěno', sk: 'uložené, nespustené', en: 'saved, not run' }, locale) });
  } catch (err) {
    console.error('/api/searches/from-profile:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
