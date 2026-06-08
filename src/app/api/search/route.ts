import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken, getPlanLimits } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { searchPlaces } from '@/lib/google-places';
import { searchFirmy } from '@/lib/firmy-scraper';

export const maxDuration = 60;
import { analyzeBusinessFull, isRealWebsite } from '@/lib/business-checks';

const SearchSchema = z.object({
  region: z.string().min(1),
  industry: z.string().min(1),
});

// English industry value → Czech term for Firmy.cz
const INDUSTRY_CS_MAP: Record<string, string> = {
  'plumber': 'Instalatér',
  'electrician': 'Elektrikář',
  'carpenter': 'Tesař',
  'painter': 'Malíř pokojů',
  'roofer': 'Pokrývač',
  'landscaper': 'Zahradník',
  'restaurant': 'Restaurace',
  'cafe': 'Kavárna',
  'bakery': 'Pekárna',
  'butcher shop': 'Řeznictví',
  'hair salon': 'Kadeřnictví',
  'beauty salon': 'Kosmetický salon',
  'nail studio': 'Nehtové studio',
  'massage': 'Masáže',
  'car repair': 'Autoservis',
  'tire shop': 'Pneuservis',
  'accountant': 'Účetní',
  'photographer': 'Fotograf',
  'cleaning service': 'Úklidová firma',
  'veterinarian': 'Veterinář',
  'general practitioner': 'Praktický lékař',
  'dentist': 'Zubař',
  'physiotherapist': 'Fyzioterapeut',
  'pharmacy': 'Lékárna',
  'optician': 'Optika',
  'lawyer': 'Právník',
  'real estate agency': 'Realitní kancelář',
  'driving school': 'Autoškola',
  'language school': 'Jazyková škola',
  'gym': 'Fitness centrum',
  'personal trainer': 'Osobní trenér',
  'yoga studio': 'Jóga studio',
  'florist': 'Floristika',
  'tailor': 'Krejčí',
  'locksmith': 'Zámečník',
  'glazier': 'Sklenář',
  'chimney sweep': 'Kominík',
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
  ]);
}

// Extract first city/region name for Firmy.cz (skip Slovak regions)
function getFirmyCityQuery(region: string, industryCz: string): string | null {
  if (
    region.includes('Slovakia') ||
    region.includes('Germany') ||
    region.includes('Austria') ||
    region.includes('UK') ||
    region.includes('USA') ||
    region.includes('Poland')
  ) return null;

  const city = region.split(',')[0].trim();
  return `${industryCz} ${city}`.trim();
}

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

    // Run Google Places and Firmy.cz in parallel
    const industryCz = INDUSTRY_CS_MAP[industry] ?? industry;
    const firmyQuery = getFirmyCityQuery(region, industryCz);

    const [places, firmyResult] = await Promise.all([
      searchPlaces(industry, region),
      firmyQuery
        ? withTimeout(
            searchFirmy(firmyQuery, '', { onlyNoWebsite: false, maxPages: 3 }),
            15_000
          )
        : Promise.resolve(null),
    ]);

    const limitedPlaces = places.slice(0, limits.resultsPerSearch);

    // Analyze Google Places results
    const googleResults = (await analyzeInBatches(
      limitedPlaces,
      async (place) => {
        const checks = await analyzeBusinessFull(place.website);
        const hasWebsite = isRealWebsite(place.website);
        return prisma.businessResult.create({
          data: {
            searchId:      search.id,
            placeId:       place.place_id,
            name:          place.name,
            phone:         place.formatted_phone_number || place.international_phone_number,
            address:       place.formatted_address,
            website:       hasWebsite ? place.website : undefined,
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
            source:        'google',
          },
        });
      },
      8
    )).filter(Boolean);

    // Save Firmy.cz results (deduplicated against Google results)
    const googleNames = new Set(
      googleResults
        .filter(Boolean)
        .map((r: any) => r.name?.toLowerCase().trim())
    );

    const firmyLeads = firmyResult?.leads ?? [];
    const uniqueFirmyLeads = firmyLeads.filter(
      l => !googleNames.has(l.name.toLowerCase().trim())
    );

    const firmyDbResults = await Promise.all(
      uniqueFirmyLeads.slice(0, Math.max(0, limits.resultsPerSearch - limitedPlaces.length)).map(lead =>
        prisma.businessResult.create({
          data: {
            searchId:  search.id,
            placeId:   lead.firmyUrl,
            name:      lead.name,
            phone:     lead.phone,
            address:   lead.address,
            website:   lead.website,
            hasWebsite: lead.hasWebsite,
            hasFacebook: false,
            hasInstagram: false,
            hasLinkedIn: false,
            websiteIsOld: false,
            websiteScore: 50,
            websiteAgeNote: '',
            reviewCount: 0,
            googleMapsUrl: lead.firmyUrl,
            source:    'firmy',
          },
        }).catch(() => null)
      )
    );

    const allResults = [
      ...googleResults.filter(Boolean),
      ...firmyDbResults.filter(Boolean),
    ];

    return NextResponse.json({ searchId: search.id, results: allResults });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 });
    }
    console.error('Search error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
