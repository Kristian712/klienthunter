import axios from 'axios';

const GOOGLE_PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';
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

export async function searchPlaces(query: string, region: string): Promise<PlaceResult[]> {
  const searchQuery = `${query} ${region}`;

  const textSearchRes = await axios.get(`${GOOGLE_PLACES_BASE}/textsearch/json`, {
    params: {
      query: searchQuery,
      key: API_KEY,
      language: 'cs',
    },
  });

  if (textSearchRes.data.status !== 'OK' && textSearchRes.data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places API error: ${textSearchRes.data.status}`);
  }

  const places = textSearchRes.data.results || [];
  const detailedPlaces: PlaceResult[] = [];

  for (const place of places.slice(0, 20)) {
    try {
      const details = await getPlaceDetails(place.place_id);
      detailedPlaces.push(details);
    } catch {
      detailedPlaces.push({
        place_id: place.place_id,
        name: place.name,
        formatted_address: place.formatted_address,
        rating: place.rating,
        user_ratings_total: place.user_ratings_total,
        types: place.types,
      });
    }
  }

  return detailedPlaces;
}

export async function getPlaceDetails(placeId: string): Promise<PlaceResult> {
  const res = await axios.get(`${GOOGLE_PLACES_BASE}/details/json`, {
    params: {
      place_id: placeId,
      fields: 'place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,types,url',
      key: API_KEY,
      language: 'cs',
    },
  });

  if (res.data.status !== 'OK') {
    throw new Error(`Place details error: ${res.data.status}`);
  }

  return res.data.result;
}
