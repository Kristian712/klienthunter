import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken, getPlanLimits } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { searchPlaces } from '@/lib/google-places';
import { analyzeBusinessFull } from '@/lib/business-checks';

const SearchSchema = z.object({
  region: z.string().min(1),
  industry: z.string().min(1),
});

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

    const places = await searchPlaces(industry, region);
    const limitedPlaces = places.slice(0, limits.resultsPerSearch);

    const results = await Promise.all(
      limitedPlaces.map(async (place) => {
        const checks = await analyzeBusinessFull(place.website);
        return prisma.businessResult.create({
          data: {
            searchId: search.id,
            placeId: place.place_id,
            name: place.name,
            phone: place.formatted_phone_number || place.international_phone_number,
            address: place.formatted_address,
            website: place.website,
            hasWebsite:    checks.hasWebsite,
            hasFacebook:   checks.hasFacebook,
            hasInstagram:  checks.hasInstagram,
            hasLinkedIn:   checks.hasLinkedIn,
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
      })
    );

    return NextResponse.json({ searchId: search.id, results });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 });
    }
    console.error('Search error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
