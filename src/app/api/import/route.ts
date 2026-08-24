import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken, getPlanLimits } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { persistResults } from '@/lib/lead-persist';
import { enrichAndVerify, mergeLeads } from '@/lib/lead-pipeline';
import type { RawLead } from '@/lib/sources';

export const maxDuration = 60;

/**
 * Takes a list the user already had and runs it through the same pipeline as a search:
 * merge duplicates, ask ARES-RŽP and the VAT register, verify the websites, write the rows.
 *
 * The CSV itself is parsed in the browser — the column-mapping screen needs the headers
 * anyway, so sending the raw file here would only mean handling an upload for nothing.
 */

/** Sixty seconds is sixty seconds. Anything past the cap is cut off and reported back. */
const HARD_ROW_CAP = 2000;
const NETWORK_BUDGET_MS = 45_000;

const RowSchema = z.object({
  name: z.string().trim().min(1),
  ico: z.string().trim().optional(),
  website: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
});

const ImportSchema = z.object({
  filename: z.string().trim().min(1).max(120),
  rows: z.array(RowSchema).min(1),
});

/** Empty strings from a spreadsheet must not become empty-but-present fields. */
function clean(value?: string): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    const body = await req.json();
    const { filename, rows } = ImportSchema.parse(body);

    const limits = getPlanLimits(payload.plan, payload.isVip, payload.isAdmin);

    // An import costs the same minute of compute as a search, so it counts against the same
    // monthly allowance.
    if (limits.searches !== Infinity) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const used = await prisma.search.count({
        where: { userId: payload.userId, createdAt: { gte: thirtyDaysAgo } },
      });
      if (used >= limits.searches) {
        return NextResponse.json({ error: 'Search limit reached for your plan' }, { status: 403 });
      }
    }

    const cap = Math.min(rows.length, limits.resultsPerSearch, HARD_ROW_CAP);
    const skipped = rows.length - cap;

    const leads: RawLead[] = rows.slice(0, cap).map((r, i) => ({
      sourceId: 'csv',
      externalId: `csv:${i}`,
      name: r.name.trim(),
      ico: clean(r.ico)?.replace(/\s/g, ''),
      website: clean(r.website),
      phone: clean(r.phone),
      email: clean(r.email),
      address: clean(r.address),
    }));

    // An imported row is scored against the same criteria as a searched one, or the import
    // would rank by a different rule than the rest of the app.
    const profile = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { targetFilters: true },
    });

    // Stored as a search so the import shows up in the history and can be exported, reopened
    // and deleted exactly like one.
    const search = await prisma.search.create({
      data: { userId: payload.userId, query: 'CSV import', region: filename },
    });

    const deadlineAt = Date.now() + NETWORK_BUDGET_MS;
    // One batch, but mergeLeads still earns its keep: the same firm often appears twice in a
    // hand-maintained spreadsheet.
    const candidates = mergeLeads([leads], cap);
    const verified = await enrichAndVerify(candidates, { probeNetwork: true, deadlineAt });
    const results = await persistResults(search.id, verified, profile?.targetFilters);

    return NextResponse.json({
      searchId: search.id,
      imported: results.length,
      skipped,
      results,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 });
    }
    console.error('Import error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
