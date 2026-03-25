import { NextResponse } from "next/server";

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

async function reverseWithMapbox(lat: number, lng: number, token: string) {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/reverse");
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const json = (await res.json()) as { features?: Array<Record<string, unknown>> };
  const feature = Array.isArray(json.features) ? json.features[0] : null;
  if (!feature) return null;
  const props = (feature.properties as Record<string, unknown>) ?? {};
  const context = (props.context as Record<string, unknown>) ?? {};
  const place = (context.place as Record<string, unknown> | undefined) ?? {};
  const locality = (context.locality as Record<string, unknown> | undefined) ?? {};
  const region = (context.region as Record<string, unknown> | undefined) ?? {};
  const postcode = (context.postcode as Record<string, unknown> | undefined) ?? {};

  return {
    fullAddress: String(props.full_address ?? props.name ?? "Current location"),
    street: String(props.address_line1 ?? props.name ?? ""),
    city: String(place.name ?? locality.name ?? "Unknown"),
    state: String(region.region_code ?? region.name ?? "CA"),
    zip: String(postcode.name ?? ""),
    lat,
    lng,
  };
}

async function reverseWithGoogle(lat: number, lng: number, key: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    status?: string;
    results?: Array<{
      formatted_address?: string;
      address_components?: Array<{ long_name?: string; short_name?: string; types?: string[] }>;
    }>;
  };
  if (json.status !== "OK" || !Array.isArray(json.results) || json.results.length === 0) {
    return null;
  }

  const result = json.results[0];
  const components = Array.isArray(result.address_components) ? result.address_components : [];
  const byType = (type: string, short = false) =>
    components.find((c) => Array.isArray(c.types) && c.types.includes(type))
      ?.[short ? "short_name" : "long_name"] ?? "";

  const streetNum = byType("street_number");
  const route = byType("route");
  const street = [streetNum, route].filter(Boolean).join(" ").trim();
  const city = byType("locality") || byType("sublocality") || byType("neighborhood") || "Unknown";
  const state = byType("administrative_area_level_1", true) || "CA";
  const zip = byType("postal_code");

  return {
    fullAddress: String(result.formatted_address ?? "Current location"),
    street: street || String(result.formatted_address ?? ""),
    city,
    state,
    zip,
    lat,
    lng,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = parseNumber(searchParams.get("lat"));
  const lng = parseNumber(searchParams.get("lng"));
  if (lat == null || lng == null) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? "";
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";

  if (mapboxToken) {
    const address = await reverseWithMapbox(lat, lng, mapboxToken);
    if (address) return NextResponse.json({ address });
  }

  if (googleKey) {
    const address = await reverseWithGoogle(lat, lng, googleKey);
    if (address) return NextResponse.json({ address });
  }

  return NextResponse.json(
    { error: "No address found for your location. Check Mapbox/Google API keys and billing." },
    { status: 502 }
  );
}
