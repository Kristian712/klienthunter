import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken, getPlanLimits } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { persistResults } from '@/lib/lead-persist';
import { enrichAndVerify, mergeLeads } from '@/lib/lead-pipeline';
import { discoverAll } from '@/lib/sources';

export const maxDuration = 60;

const SearchSchema = z.object({
  region: z.string().min(1),
  industry: z.string().min(1),
});

const WHOLE_CZ_TRIGGERS = ['celá čr', 'cela cr', 'celá cr', 'celé česko'];

function isWholeCz(region: string): boolean {
  return WHOLE_CZ_TRIGGERS.includes(region.toLowerCase().trim());
}

/**
 * Leaves roughly ten seconds of the function's minute for the database writes and the
 * response itself. Everything that does not fit is skipped, not waited for: a lead with an
 * unverified website is still a lead, a timed-out request is a 504.
 */
const NETWORK_BUDGET_MS = 45_000;

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    const body = await req.json();
    const { region, industry } = SearchSchema.parse(body);

    const limits = getPlanLimits(payload.plan, payload.isVip, payload.isAdmin);

    if (limits.searches !== Infinity) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const searchCount = await prisma.search.count({
        where: { userId: payload.userId, createdAt: { gte: thirtyDaysAgo } },
      });
      if (searchCount >= limits.searches) {
        return NextResponse.json({ error: 'Search limit reached for your plan' }, { status: 403 });
      }
    }

    // Ranking is per-user: the score of a row is the share of *this* user's onboarding criteria
    // the firm meets. Someone who skipped onboarding has an empty list and gets the neutral
    // default from `lead-score.ts`.
    const profile = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { targetFilters: true },
    });

    const search = await prisma.search.create({
      data: { userId: payload.userId, query: industry, region },
    });

    const deadlineAt = Date.now() + NETWORK_BUDGET_MS;
    const wholeCz = isWholeCz(region);
    const city = wholeCz ? '' : region.split(',')[0].trim();
    const limit = limits.resultsPerSearch;

    // Order matters: OpenStreetMap goes first because it is the only source carrying phones,
    // e-mails and websites, so its records deserve the slots. ARES then confirms them with an
    // IČO and fills the rest with firms OSM has never heard of.
    const [aresLeads, osmLeads] = await discoverAll(industry, city, limit);
    const candidates = mergeLeads([osmLeads, aresLeads], limit);

    // A nationwide run would need thousands of probes and would never finish, so it skips the
    // network entirely and yields only HAS / UNKNOWN from what the sources already said.
    const verified = await enrichAndVerify(candidates, { probeNetwork: !wholeCz, deadlineAt });
    const results = await persistResults(search.id, verified, profile?.targetFilters);

    return NextResponse.json({ searchId: search.id, results });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 });
    }
    console.error('Search error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
