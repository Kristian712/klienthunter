// TEST MODE: no auth, no DB – returns results directly from Google Places + web checks
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { searchPlaces } from '@/lib/google-places';
import { analyzeBusinessFull } from '@/lib/business-checks';

const SearchSchema = z.object({
  region: z.string().min(1),
  industry: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { region, industry } = SearchSchema.parse(body);

    const places = await searchPlaces(industry, region);
    const limitedPlaces = places.slice(0, 20);

    const results = await Promise.all(
      limitedPlaces.map(async (place, i) => {
        const checks = await analyzeBusinessFull(place.website);
        return {
          id: `tmp-${i}`,
          placeId: place.place_id,
          name: place.name,
          phone: place.formatted_phone_number || place.international_phone_number || null,
          address: place.formatted_address || null,
          website: place.website || null,
          hasWebsite: checks.hasWebsite,
          hasFacebook: checks.hasFacebook,
          hasInstagram: checks.hasInstagram,
          hasLinkedIn: checks.hasLinkedIn,
          email: checks.email || null,
          reviewCount: place.user_ratings_total ?? 0,
          rating: place.rating ?? null,
          googleMapsUrl: place.url || null,
          category: place.types?.[0] || null,
        };
      })
    );

    return NextResponse.json({ searchId: null, results });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 });
    }
    console.error('Search error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
