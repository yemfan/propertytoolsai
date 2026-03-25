import { NextResponse } from "next/server";

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/** Prefer server-only key for Geocoding (browser-restricted keys fail on Vercel/server fetch). */
function googleGeocodeKey(): string {
  return (
    process.env.GOOGLE_MAPS_SERVER_KEY?.trim() ||
    process.env.GOOGLE_GEOCODING_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    ""
  );
}

function providerOrder(): Array<"mapbox" | "google" | "nominatim"> {
  const p = (process.env.NEXT_PUBLIC_ADDRESS_PROVIDER ?? "mapbox").trim().toLowerCase();
  if (p === "google") return ["google", "mapbox", "nominatim"];
  return ["mapbox", "google", "nominatim"];
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
  const addrCtx = (context.address as Record<string, unknown> | undefined) ?? {};
  const place = (context.place as Record<string, unknown> | undefined) ?? {};
  const locality = (context.locality as Record<string, unknown> | undefined) ?? {};
  const region = (context.region as Record<string, unknown> | undefined) ?? {};
  const postcode = (context.postcode as Record<string, unknown> | undefined) ?? {};

  const lineFromContext = [addrCtx.address_number, addrCtx.street_name]
    .filter((x) => typeof x === "string" && x.trim())
    .join(" ")
    .trim();

  const street =
    lineFromContext ||
    String(props.address_line1 ?? props.name ?? "").trim() ||
    String(props.name ?? "");

  const fullAddress = String(
    props.full_address ?? props.place_formatted ?? props.name ?? "Current location"
  );

  return {
    fullAddress,
    street,
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
  if (!res.ok) return { address: null as null, googleError: `HTTP ${res.status}` };

  const json = (await res.json()) as {
    status?: string;
    error_message?: string;
    results?: Array<{
      formatted_address?: string;
      address_components?: Array<{ long_name?: string; short_name?: string; types?: string[] }>;
    }>;
  };

  if (json.status === "REQUEST_DENIED" || json.status === "INVALID_REQUEST") {
    return {
      address: null as null,
      googleError: json.error_message || `Google Geocoding: ${json.status}`,
    };
  }

  if (json.status !== "OK" || !Array.isArray(json.results) || json.results.length === 0) {
    return { address: null as null, googleError: json.error_message || `Google: ${json.status ?? "no results"}` };
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
    address: {
      fullAddress: String(result.formatted_address ?? "Current location"),
      street: street || String(result.formatted_address ?? ""),
      city,
      state,
      zip,
      lat,
      lng,
    },
    googleError: null as string | null,
  };
}

async function reverseWithNominatim(lat: number, lng: number) {
  const ua =
    process.env.NOMINATIM_USER_AGENT?.trim() ||
    "PropertyToolsAI/1.0 (https://github.com/yemfan/propertytoolsai)";
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { "User-Agent": ua, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    display_name?: string;
    address?: Record<string, string>;
  };
  const a = json.address ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ").trim();
  const city = a.city || a.town || a.village || a.hamlet || a.municipality || "Unknown";
  const state = a.state || a.region || "";
  const zip = a.postcode || "";
  const full =
    json.display_name ||
    [street, city, state, zip].filter(Boolean).join(", ") ||
    "Current location";

  return {
    fullAddress: full,
    street: street || full.split(",")[0]?.trim() || "",
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
  const googleKey = googleGeocodeKey();
  const order = providerOrder();
  const errors: string[] = [];

  for (const provider of order) {
    if (provider === "mapbox" && mapboxToken) {
      const address = await reverseWithMapbox(lat, lng, mapboxToken);
      if (address?.fullAddress) return NextResponse.json({ address });
      errors.push("Mapbox reverse geocode returned no address.");
      continue;
    }

    if (provider === "google" && googleKey) {
      const { address, googleError } = await reverseWithGoogle(lat, lng, googleKey);
      if (address) return NextResponse.json({ address });
      if (googleError) errors.push(googleError);
      continue;
    }

    if (provider === "nominatim") {
      const address = await reverseWithNominatim(lat, lng);
      if (address?.fullAddress) return NextResponse.json({ address });
      errors.push("OpenStreetMap (Nominatim) returned no address.");
      continue;
    }
  }

  const hint =
    !mapboxToken && !googleKey
      ? " Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN and/or GOOGLE_MAPS_SERVER_KEY (or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY with no referrer-only restriction for server)."
      : googleKey && errors.some((e) => e.includes("REQUEST_DENIED") || e.includes("Google Geocoding"))
        ? " For production, set GOOGLE_MAPS_SERVER_KEY with Geocoding API enabled (browser-restricted keys do not work on the server)."
        : "";

  return NextResponse.json(
    {
      error: `Could not resolve an address from your location. ${errors.filter(Boolean).join(" ")}${hint}`.trim(),
    },
    { status: 502 }
  );
}
