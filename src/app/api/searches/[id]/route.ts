import { NextRequest, NextResponse } from 'next/server';
import { sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { LEAD_FILTERS } from '@/lib/lead-filters';
import { SCENARIOS } from '@/lib/scenarios';
import { touchOpened } from '@/lib/saved-search';

/**
 * Deletes a search together with its results.
 *
 * The user is the only person who can throw these rows away, and GDPR says they must be able
 * to: a CSV import in particular is their own contact list sitting in our database. The
 * relations cascade (`BusinessResult.search` and `SavedResult.businessResult` in
 * `prisma/schema.prisma`), so one delete takes the whole tree with it.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = sessionFrom(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Scoped by userId on purpose: a stranger's id must look missing, not forbidden.
    const search = await prisma.search.findFirst({
      where: { id: params.id, userId: payload.userId },
      select: { id: true },
    });
    if (!search) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.search.delete({ where: { id: search.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('/api/searches/[id]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const FILTER_IDS = new Set(LEAD_FILTERS.map(f => f.id));
const SCENARIO_IDS = new Set(SCENARIOS.map(s => s.id));

const PatchSchema = z.object({
  /** Jméno uloží kombinaci jako hledání, ke kterému se dá vracet. Prázdné jméno uložení zruší. */
  name: z.string().trim().max(80).nullish(),
  filters: z.array(z.string()).max(LEAD_FILTERS.length)
            .refine(ids => ids.every(id => FILTER_IDS.has(id)), 'Unknown filter id').optional(),
  scenario: z.string().refine(id => SCENARIO_IDS.has(id), 'Unknown scenario').nullish(),
  /** Uživatel kořen otevřel — „nové od minule" se počítá od teď. */
  opened: z.boolean().optional(),
});

/**
 * Uložení hledání (jméno + filtry + scénář) a záznam otevření. Jméno se ukládá na kořen: když
 * je tenhle běh dalším spuštěním uloženého hledání, jméno i filtry patří tomu kořeni.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = sessionFrom(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = PatchSchema.parse(await req.json());

    const search = await prisma.search.findFirst({
      where: { id: params.id, userId: payload.userId },
      select: { id: true, savedId: true },
    });
    if (!search) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const rootId = search.savedId ?? search.id;

    if (body.opened) await touchOpened(rootId, payload.userId);

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name || null;
    if (body.filters !== undefined) data.filters = body.filters;
    if (body.scenario !== undefined) data.scenario = body.scenario;
    const updated = Object.keys(data).length
      ? await prisma.search.update({ where: { id: rootId }, data, select: { id: true, name: true, filters: true, scenario: true, lastOpenedAt: true } })
      : await prisma.search.findUnique({ where: { id: rootId }, select: { id: true, name: true, filters: true, scenario: true, lastOpenedAt: true } });

    return NextResponse.json({ search: updated });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 422 });
    console.error('/api/searches/[id] PATCH:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
