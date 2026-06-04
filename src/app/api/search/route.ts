import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken, getPlanLimits } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { searchPlaces } from '@/lib/google-places';

export const maxDuration = 60;
import { analyzeBusinessFull } from '@/lib/business-checks';

const SearchSchema = z.object({
  region: z.string().min(1),
  industry: z.string().min(1),
});

// Run website analysis in parallel batches to avoid overwhelming target servers
async function analyzeInBatches<T>(
  items: T[],
  fn: (item: T) => Promise<unknown>,
  batchSize = 8
) {
  const results: unknown[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(fn));
    results.push(...settled.map(r => (r.status === 'fulfilled' ? r.value : null)));
  }
  return results;
}

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

    const search = await prisma.search.create({
      data: { userId: payload.userId, query: industry, region },
    });

    // Fetch all places (may take a while for Celá ČR)
    const places = await searchPlaces(industry, region);
    const limitedPlaces = places.slice(0, limits.resultsPerSearch);

    // Analyze websites in batches of 8 concurrent requests
    const results = (await analyzeInBatches(
      limitedPlaces,
      async (place) => {
        const checks = await analyzeBusinessFull(place.website);
        // hasWebsite = Google Places field is authoritative.
        // We never override it based on whether our scraper could reach the site.
        const hasWebsite = Boolean(place.website);
        return prisma.businessResult.create({
          data: {
            searchId:      search.id,
            placeId:       place.place_id,
            name:          place.name,
            phone:         place.formatted_phone_number || place.international_phone_number,
            address:       place.formatted_address,
            website:       place.website,
            hasWebsite,
            hasFacebook:   checks.hasFacebook,
            hasInstagram:  checks.hasInstagram,
            hasLinkedIn:   checks.hasLinkedIn,
            facebookUrl:   checks.facebookUrl,
            instagramUrl:  checks.instagramUrl,
            linkedInUrl:   checks.linkedInUrl,
            websiteIsOld:  checks.websiteIsOld,
            websiteScore:  checks.websiteScore,
            websiteAgeNote: checks.websiteAgeNote,
            email:         checks.email,
            reviewCount:   place.user_ratings_total ?? 0,
            rating:        place.rating,
            googleMapsUrl: place.url,
            category:      place.types?.[0],
          },
        });
      },
      8
    )).filter(Boolean);

    return NextResponse.json({ searchId: search.id, results });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 });
    }
    console.error('Search error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
