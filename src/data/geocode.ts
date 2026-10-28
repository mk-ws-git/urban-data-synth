export interface Place {
  name: string;
  country: string;
  admin1?: string; // state / region
  latitude: number;
  longitude: number;
  label: string; // "London, England, United Kingdom"
}

// Free global geocoding from Open-Meteo. No API key.
export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({
    name: q,
    count: "6",
    language: "en",
    format: "json",
  });
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?${params}`,
  );
  if (!res.ok) return [];
  const json = await res.json();
  const results: any[] = json.results ?? [];
  return results.map((r) => ({
    name: r.name,
    country: r.country ?? "",
    admin1: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
    label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
  }));
}
