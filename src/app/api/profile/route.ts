import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken, hashPassword, comparePassword } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { LEAD_FILTERS } from '@/lib/lead-filters';
import { PROFESSIONS } from '@/lib/profile';

const PROFESSION_IDS = PROFESSIONS.map(p => p.id);
const FILTER_IDS = new Set(LEAD_FILTERS.map(f => f.id));

/**
 * Optional *and* clearable — and those are two different things.
 *
 *   `undefined`     the caller never mentioned this field → leave the stored value alone
 *   `''` or `null`  the caller emptied the input          → forget the stored value
 *
 * The distinction has to survive parsing, because the PATCH below decides what to write by
 * testing for `undefined`. The previous version transformed with `v => (v ? v : null)`, and a
 * zod transform runs on absent keys too — so every unsent field came out of `parse()` as an
 * explicit `null`. Saving the signature alone in settings wiped the whole targeting profile.
 */
const nullableText = (max: number) =>
  z.string().trim().max(max).nullish().transform(v => (v === undefined ? undefined : v || null));

const UpdateSchema = z.object({
  name:        z.string().min(1).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),

  // ── Onboarding profile ──
  // Every field is optional so the modal, the settings form and a plain rename can all use
  // this one endpoint and send only what they changed.
  profession:     z.enum(PROFESSION_IDS as [string, ...string[]]).nullish(),
  professionText: nullableText(120),
  targetIndustry: nullableText(120),
  targetRegion:   nullableText(120),
  targetCity:     nullableText(120),
  // Unknown ids are rejected rather than dropped: they can only come from a tampered request,
  // and silently storing them would leave the profile lying about what it ranks by.
  targetFilters:  z.array(z.string()).max(LEAD_FILTERS.length)
                    .refine(ids => ids.every(id => FILTER_IDS.has(id)), 'Unknown filter id')
                    .optional(),
  /** Sent as `true` on both finishing and skipping the modal — we ask once either way. */
  onboarded:      z.boolean().optional(),
  // Roomier than the rest: it usually holds a URL and a phone number on one line.
});

const PROFILE_SELECT = {
  profession: true, professionText: true, targetIndustry: true,
  targetRegion: true, targetCity: true, targetFilters: true, onboardedAt: true,
} as const;

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true, email: true, name: true, plan: true,
        isAdmin: true, isVip: true, createdAt: true,
        ...PROFILE_SELECT,
        _count: { select: { searches: true } },
      },
    });
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const searches = await prisma.search.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { _count: { select: { results: true } } },
    });

    const totalResults = await prisma.businessResult.count({
      where: { search: { userId: payload.userId } },
    });

    return NextResponse.json({ user, searches, totalResults });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    const body = await req.json();
    const parsed = UpdateSchema.parse(body);
    const { name, currentPassword, newPassword, onboarded, ...profile } = parsed;

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;

    // `undefined` means the caller did not touch the field; `null` means they cleared it. Only
    // the first is skipped.
    for (const [key, value] of Object.entries(profile)) {
      if (value !== undefined) updateData[key] = value;
    }

    // One-way: once asked, never asked again — including when the user skipped.
    if (onboarded && !user.onboardedAt) updateData.onboardedAt = new Date();

    if (newPassword) {
      if (!currentPassword) return NextResponse.json({ error: 'Current password required' }, { status: 400 });
      const valid = await comparePassword(currentPassword, user.password);
      if (!valid) return NextResponse.json({ error: 'Wrong current password' }, { status: 400 });
      updateData.password = await hashPassword(newPassword);
    }

    const updated = await prisma.user.update({
      where: { id: payload.userId },
      data: updateData,
      select: {
        id: true, email: true, name: true, plan: true, isAdmin: true, isVip: true,
        ...PROFILE_SELECT,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 422 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
