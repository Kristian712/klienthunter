import { NextRequest, NextResponse } from 'next/server';
import { sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { withoutOptouts } from '@/lib/optout';
import { industryLabel } from '@/lib/search-options';

export const dynamic = 'force-dynamic';

/** Kolik karet nejvýš. Kdo má víc, má CRM — tohle je pracovní deska, ne archiv. */
const MAX_CARDS = 300;

/**
 * Nástěnka (kanban) na přehledu: všechny firmy, které si uživatel označil, napříč hledáními.
 *
 * Značky se do teď daly vidět jen uvnitř jednoho hledání. Kdo obvolává firmy z pěti hledání,
 * neměl jediné místo, kde vidí „koho jsem oslovil a s kým jednám". Sloupce jsou stavy značky;
 * přesun karty je totéž PUT /api/leads/[id]/tag jako přepínač u řádku.
 */
export async function GET(req: NextRequest) {
  const payload = sessionFrom(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const tags = await prisma.leadTag.findMany({
      where: { userId: payload.userId, status: { not: 'new' } },
      orderBy: { updatedAt: 'desc' },
      take: MAX_CARDS,
      include: {
        business: {
          select: {
            id: true, name: true, phone: true, email: true, website: true, address: true, ico: true, placeId: true,
            leadScore: true, searchId: true,
            search: { select: { query: true, region: true, name: true } },
          },
        },
      },
    });
    // Vyřazené subjekty se nezobrazují nikde — ani na nástěnce.
    const visible = await withoutOptouts(tags.map(t => ({ ...t, ico: t.business.ico, placeId: t.business.placeId })));
    return NextResponse.json({
      cards: visible.map(t => ({
        id: t.business.id,
        status: t.status,
        note: t.note,
        updatedAt: t.updatedAt,
        name: t.business.name,
        phone: t.business.phone,
        email: t.business.email,
        website: t.business.website,
        address: t.business.address,
        ico: t.business.ico,
        score: t.business.leadScore,
        searchId: t.business.searchId,
        // Jméno uloženého hledání, jinak „Autodoprava · Zlín"; `*` = všechny obory, ne hvězdička.
        searchLabel: t.business.search.name ?? `${industryLabel(t.business.search.query, 'cs')} · ${t.business.search.region.split(',')[0]}`,
      })),
    });
  } catch (err) {
    console.error('/api/pipeline:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
