// Shared helpers for the LocationPicker (search & reverse geocode via OpenStreetMap Nominatim).
export type PickedLocation = {
  latitude: number;
  longitude: number;
  address: string;
};

export type Suggestion = {
  display_name: string;
  lat: string;
  lon: string;
};

export const DEFAULT_REGION = { latitude: 22.7196, longitude: 75.8577 };
const NOMINATIM = "https://nominatim.openstreetmap.org";

export async function searchNominatim(query: string): Promise<Suggestion[]> {
  if (!query.trim()) return [];
  const url = `${NOMINATIM}/search?format=json&limit=6&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  return await res.json();
}

export async function reverseNominatim(lat: number, lon: number): Promise<string> {
  try {
    const url = `${NOMINATIM}/reverse?format=json&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    return data?.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }
}
