import axios from 'axios';

const BASE = 'https://maps.googleapis.com/maps/api/place';
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  url?: string;
}

// All 14 Czech regional capitals (one per kraj)
const CZ_REGIONS = [
  'Praha',
  'Kladno',            // Středočeský kraj
  'České Budějovice',  // Jihočeský kraj
  'Plzeň',             // Plzeňský kraj
  'Karlovy Vary',      // Karlovarský kraj
  'Ústí nad Labem',    // Ústecký kraj
  'Liberec',           // Liberecký kraj
  'Hradec Králové',    // Královéhradecký kraj
  'Pardubice',         // Pardubický kraj
  'Jihlava',           // Kraj Vysočina
  'Brno',              // Jihomoravský kraj
  'Olomouc',           // Olomoucký kraj
  'Zlín',              // Zlínský kraj
  'Ostrava',           // Moravskoslezský kraj
];

const WHOLE_CZ_TRIGGERS = [
  'celá čr', 'cela cr', 'celé česko', 'cele cesko',
  'česká republika', 'ceska republika', 'czech republic', 'czechia',
];

function isWholeCzechRepublic(region: string): boolean {
  return WHOLE_CZ_TRIGGERS.includes(region.toLowerCase().trim());
}

export async function searchPlaces(query: string, region: string): Promise<PlaceResult[]> {
  if (isWholeCzechRepublic(region)) {
    return searchWholeCzechRepublic(query);
  }
  return searchSingleRegion(query, region);
}

// ── Single city/region ────────────────────────────────────────────────────────

async function searchSingleRegion(query: string, region: string): Promise<PlaceResult[]> {
  const rawPlaces = await fetchAllPages(`${query} ${region}`);
  return enrichWithDetails(rawPlaces);
}

// ── Whole Czech Republic ──────────────────────────────────────────────────────

async function searchWholeCzechRepublic(query: string): Promise<PlaceResult[]> {
  // Search all 14 regions in parallel, each with full pagination
  const regionResults = await Promise.allSettled(
    CZ_REGIONS.map(city => fetchAllPages(`${query} ${city} Czech Republic`))
  );

  // Merge & deduplicate by place_id
  const seen = new Set<string>();
  const allPlaces: any[] = [];

  for (const result of regionResults) {
    if (result.status !== 'fulfilled') continue;
    for (const place of result.value) {
      if (!seen.has(place.place_id)) {
        seen.add(place.place_id);
        allPlaces.push(place);
      }
    }
  }

  // Enrich with Details API in parallel (phone, website, url)
  return enrichWithDetails(allPlaces);
}

// ── Google Places pagination (up to 3 pages = 60 results per query) ──────────

async function fetchAllPages(query: string): Promise<any[]> {
  const allResults: any[] = [];

  // Page 1
  const page1 = await axios.get(`${BASE}/textsearch/json`, {
    params: { query, key: API_KEY, language: 'cs' },
  });

  if (page1.data.status !== 'OK' && page1.data.status !== 'ZERO_RESULTS') {
    return [];
  }

  allResults.push(...(page1.data.results ?? []));

  // Page 2
  if (page1.data.next_page_token) {
    await sleep(2000); // Google requires 2s before using page token
    const page2 = await axios.get(`${BASE}/textsearch/json`, {
      params: { pagetoken: page1.data.next_page_token, key: API_KEY, language: 'cs' },
    });
    allResults.push(...(page2.data.results ?? []));

    // Page 3
    if (page2.data.next_page_token) {
      await sleep(2000);
      const page3 = await axios.get(`${BASE}/textsearch/json`, {
        params: { pagetoken: page2.data.next_page_token, key: API_KEY, language: 'cs' },
      });
      allResults.push(...(page3.data.results ?? []));
    }
  }

  return allResults;
}

// ── Enrich with Place Details (phone, website, url) ───────────────────────────

async function enrichWithDetails(places: any[]): Promise<PlaceResult[]> {
  // Run Details API calls in parallel, batched to avoid hammering the API
  const BATCH = 10;
  const results: PlaceResult[] = [];

  for (let i = 0; i < places.length; i += BATCH) {
    const batch = places.slice(i, i + BATCH);
    const settled = await Promise.allSettled(
      batch.map(p => getPlaceDetails(p.place_id))
    );

    for (let j = 0; j < batch.length; j++) {
      const d = settled[j];
      if (d.status === 'fulfilled') {
        results.push(d.value);
      } else {
        // Fall back to text-search data (no phone/website, but still useful)
        const p = batch[j];
        results.push({
          place_id:          p.place_id,
          name:              p.name,
          formatted_address: p.formatted_address,
          rating:            p.rating,
          user_ratings_total: p.user_ratings_total,
          types:             p.types,
        });
      }
    }
  }

  return results;
}

// ── Place Details ─────────────────────────────────────────────────────────────

export async function getPlaceDetails(placeId: string): Promise<PlaceResult> {
  const res = await axios.get(`${BASE}/details/json`, {
    params: {
      place_id: placeId,
      fields: 'place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,types,url',
      key: API_KEY,
      language: 'cs',
    },
  });

  if (res.data.status !== 'OK') throw new Error(`Place details: ${res.data.status}`);
  return res.data.result;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
