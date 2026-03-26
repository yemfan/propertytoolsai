/**
 * Resolve lat/lng for an address when the client did not send coordinates (e.g. typed / funnel flow).
 */
export async function forwardGeocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  const q = query.trim();
  if (!q) return null;

  const mapboxToken =
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? process.env.MAPBOX_ACCESS_TOKEN?.trim() ?? "";
  if (mapboxToken) {
    try {
      const url = new URL(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`
      );
      url.searchParams.set("access_token", mapboxToken);
      url.searchParams.set("country", "US");
      url.searchParams.set("limit", "1");
      const res = await fetch(url.toString(), { next: { revalidate: 0 } });
      if (res.ok) {
        const json = (await res.json()) as { features?: Array<{ geometry?: { coordinates?: number[] } }> };
        const c = json?.features?.[0]?.geometry?.coordinates;
        if (
          Array.isArray(c) &&
          c.length >= 2 &&
          Number.isFinite(Number(c[0])) &&
          Number.isFinite(Number(c[1]))
        ) {
          return { lng: Number(c[0]), lat: Number(c[1]) };
        }
      }
    } catch {
      /* fall through */
    }
  }

  const googleKey =
    process.env.GOOGLE_MAPS_SERVER_KEY?.trim() ||
    process.env.GOOGLE_GEOCODING_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    "";
  if (googleKey) {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("address", q);
      url.searchParams.set("key", googleKey);
      const res = await fetch(url.toString(), { next: { revalidate: 0 } });
      if (res.ok) {
        const json = (await res.json()) as {
          results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>;
        };
        const loc = json?.results?.[0]?.geometry?.location;
        if (
          loc &&
          Number.isFinite(Number(loc.lat)) &&
          Number.isFinite(Number(loc.lng))
        ) {
          return { lat: Number(loc.lat), lng: Number(loc.lng) };
        }
      }
    } catch {
      /* fall through */
    }
  }

  return null;
}
