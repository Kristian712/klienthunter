import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sessionFrom, hashPassword, comparePassword } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { LEAD_FILTERS } from '@/lib/lead-filters';
import { LEGACY_PROFESSION, PROFESSIONS, professionById } from '@/lib/profile';
import { isWebhookUrl, newWebhookSecret } from '@/lib/webhook';

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
  /** Odpověď na druhou otázku dotazníku; musí patřit k vybranému profilu (kontrola níž). */
  clientType:     nullableText(40),
  targetIndustry: nullableText(120),
  targetRegion:   nullableText(120),
  // Unknown ids are rejected rather than dropped: they can only come from a tampered request,
  // and silently storing them would leave the profile lying about what it ranks by.
  targetFilters:  z.array(z.string()).max(LEAD_FILTERS.length)
                    .refine(ids => ids.every(id => FILTER_IDS.has(id)), 'Unknown filter id')
                    .optional(),
  /** Sent as `true` on both finishing and skipping the modal — we ask once either way. */
  onboarded:      z.boolean().optional(),
  /** Webhook pro Make/Zapier. Jen https a ne vnitřní síť (lib/webhook.ts). Prázdné = vypnout. */
  webhookUrl:     nullableText(300).refine(v => v == null || isWebhookUrl(v), 'Webhook must be an https URL'),
  // Roomier than the rest: it usually holds a URL and a phone number on one line.
});

const PROFILE_SELECT = {
  profession: true, professionRaw: true, professionText: true, clientType: true, targetIndustry: true,
  targetRegion: true, targetFilters: true, onboardedAt: true,
  webhookUrl: true, webhookSecret: true,
} as const;

/**
 * Sloučení profesí do šesti profilů (12. 9. 2026), dotaženo při prvním čtení účtu.
 *
 * Staré id (`accounting`, `legal`, …) se přepíše na nový profil a původní hodnota zůstane
 * v `professionRaw` — informace, kdo si vybral účetnictví a kdo právo, se nesmí ztratit.
 * Děje se to tady, ne v build skriptu: dotkne se jen účtů, které se ještě přihlásí.
 */
async function migrateLegacyProfession(userId: string, profession: string | null, raw: string | null) {
  if (!profession || !(profession in LEGACY_PROFESSION)) return null;
  return prisma.user.update({
    where: { id: userId },
    data: { profession: LEGACY_PROFESSION[profession], professionRaw: raw ?? profession },
    select: PROFILE_SELECT,
  });
}

export async function GET(req: NextRequest) {
  try {
    const payload = sessionFrom(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true, email: true, name: true, plan: true,
        isAdmin: true, isVip: true, createdAt: true,
        // Stav předplatného kvůli varování o neprošlé platbě a odpočtu zkušebního období.
        // Stripe ID zůstávají na serveru — v prohlížeči nemají co dělat.
        subscriptionStatus: true, currentPeriodEnd: true, trialEndsAt: true,
        ...PROFILE_SELECT,
        _count: { select: { searches: true } },
      },
    });
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const migrated = await migrateLegacyProfession(user.id, user.profession, user.professionRaw);
    if (migrated) Object.assign(user, migrated);

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
  } catch (err) {
    console.error('/api/profile:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = sessionFrom(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const parsed = UpdateSchema.parse(body);
    const { name, currentPassword, newPassword, onboarded, webhookUrl, ...profile } = parsed;

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Druhá otázka existuje jen u některých profilů a její volby jsou pevně dané; cizí hodnota
    // by v profilu lhala o tom, podle čeho se předvyplňuje.
    if (profile.clientType) {
      const target = professionById(profile.profession ?? user.profession);
      if (!target?.followUp?.options.some(o => o.id === profile.clientType)) {
        return NextResponse.json({ error: 'Unknown clientType for this profession' }, { status: 422 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    // První zaznamenaná odpověď se schovává napořád — u nového účtu je to tentýž profil, u starého
    // ji už doplnila migrace při čtení. Změna profilu ji nepřepisuje.
    if (profile.profession && !user.professionRaw) updateData.professionRaw = profile.profession;
    // Změna profilu zahazuje odpověď na druhou otázku — patří k jinému profilu.
    if (profile.profession && profile.profession !== user.profession && profile.clientType === undefined) {
      updateData.clientType = null;
    }

    // `undefined` means the caller did not touch the field; `null` means they cleared it. Only
    // the first is skipped.
    for (const [key, value] of Object.entries(profile)) {
      if (value !== undefined) updateData[key] = value;
    }

    // Webhook: s novou adresou vzniká tajemství pro podpis; smazání adresy smaže i tajemství.
    if (webhookUrl !== undefined) {
      updateData.webhookUrl = webhookUrl;
      updateData.webhookSecret = webhookUrl ? (user.webhookSecret ?? newWebhookSecret()) : null;
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
