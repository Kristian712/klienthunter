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

// Major Czech cities covering all regions
const CZ_CITIES = [
  'Praha', 'Brno', 'Ostrava', 'Plzeň', 'Liberec',
  'Olomouc', 'Ústí nad Labem', 'České Budějovice',
  'Hradec Králové', 'Pardubice', 'Zlín', 'Jihlava',
];

const WHOLE_CZ_TRIGGERS = ['celá čr', 'cela cr', 'celé česko', 'czech republic', 'česká republika'];

function isWholeCzechRepublic(region: string): boolean {
  return WHOLE_CZ_TRIGGERS.includes(region.toLowerCase().trim());
}

export async function searchPlaces(query: string, region: string): Promise<PlaceResult[]> {
  if (isWholeCzechRepublic(region)) {
    return searchWholeCzechRepublic(query);
  }
  return searchSingleRegion(query, region);
}

async function searchSingleRegion(query: string, region: string): Promise<PlaceResult[]> {
  const res = await axios.get(`${BASE}/textsearch/json`, {
    params: { query: `${query} ${region}`, key: API_KEY, language: 'cs' },
  });

  if (res.data.status !== 'OK' && res.data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places API: ${res.data.status}`);
  }

  return enrichPlaces(res.data.results ?? []);
}

async function searchWholeCzechRepublic(query: string): Promise<PlaceResult[]> {
  // Search all major cities in parallel, then deduplicate
  const cityResults = await Promise.allSettled(
    CZ_CITIES.map(city =>
      axios.get(`${BASE}/textsearch/json`, {
        params: { query: `${query} ${city}`, key: API_KEY, language: 'cs' },
      })
    )
  );

  const seen = new Set<string>();
  const allPlaces: any[] = [];

  for (const result of cityResults) {
    if (result.status !== 'fulfilled') continue;
    const places = result.value.data.results ?? [];
    for (const p of places) {
      if (!seen.has(p.place_id)) {
        seen.add(p.place_id);
        allPlaces.push(p);
      }
    }
  }

  return enrichPlaces(allPlaces);
}

async function enrichPlaces(places: any[]): Promise<PlaceResult[]> {
  const results: PlaceResult[] = [];

  // Fetch details in parallel, max 20 to avoid rate limits
  const batch = places.slice(0, 20);
  const details = await Promise.allSettled(batch.map(p => getPlaceDetails(p.place_id)));

  for (let i = 0; i < batch.length; i++) {
    const d = details[i];
    if (d.status === 'fulfilled') {
      results.push(d.value);
    } else {
      // Fallback to text-search data if details fail
      const p = batch[i];
      results.push({
        place_id: p.place_id,
        name: p.name,
        formatted_address: p.formatted_address,
        rating: p.rating,
        user_ratings_total: p.user_ratings_total,
        types: p.types,
      });
    }
  }

  return results;
}

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
