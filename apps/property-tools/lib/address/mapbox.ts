import type { AddressPrediction, AddressSearchOptions, AddressSearchProvider, AddressSelection } from "./types";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? "";

function mapboxSuggestRequestUrl(): URL {
  if (typeof window !== "undefined" && window.location?.origin) {
    return new URL("/api/mapbox/searchbox/suggest", window.location.origin);
  }
  return new URL("https://api.mapbox.com/search/searchbox/v1/suggest");
}

function mapboxRetrieveRequestUrl(mapboxId: string): URL {
  const encoded = encodeURIComponent(mapboxId);
  if (typeof window !== "undefined" && window.location?.origin) {
    return new URL(`/api/mapbox/searchbox/retrieve/${encoded}`, window.location.origin);
  }
  return new URL(`https://api.mapbox.com/search/searchbox/v1/retrieve/${encoded}`);
}
function ctxBlock(ctx: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const v = ctx[key];
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

/**
 * Map Mapbox Search JS `onRetrieve` GeoJSON feature → {@link AddressSelection}.
 * @see https://docs.mapbox.com/mapbox-search-js/api/react/autofill/
 */
export function mapboxRetrieveFeatureToAddressSelection(feature: unknown): AddressSelection | null {
  if (!feature || typeof feature !== "object") return null;
  const f = feature as Record<string, unknown>;
  const props = (f.properties as Record<string, unknown>) ?? {};
  const context = (props.context as Record<string, unknown>) ?? {};
  const geom = f.geometry as Record<string, unknown> | undefined;
  const coordinates = Array.isArray(geom?.coordinates) ? (geom!.coordinates as number[]) : [];

  const place = ctxBlock(context, "place");
  const locality = ctxBlock(context, "locality");
  const region = ctxBlock(context, "region");
  const postcode = ctxBlock(context, "postcode");

  const city = str(place?.name) || str(locality?.name) || str(props.place) || "";

  const state = str(region?.region_code) || str(region?.name) || str(props.region) || "CA";

  const zip = str(postcode?.name) || str(props.postcode) || "";

  const streetNumber = str(props.address_number);
  const streetName = str(props.street_name || props.name);
  const street = [streetNumber, streetName].filter(Boolean).join(" ").trim();

  const fullAddress =
    str(props.full_address) || str(props.place_formatted) || street || str(props.name);
  if (!fullAddress.trim()) return null;

  return {
    fullAddress: fullAddress.trim(),
    street: street || undefined,
    city: city || "Unknown",
    state,
    zip,
    lng: coordinates.length >= 2 ? coordinates[0] : undefined,
    lat: coordinates.length >= 2 ? coordinates[1] : undefined,
  };
}

/** Forward-geocoding API features use `place_name` + `context` array (not always `properties.context`). */
export function mapboxGeocodingFeatureToAddressSelection(feature: unknown): AddressSelection | null {
  if (!feature || typeof feature !== "object") return null;
  const f = feature as Record<string, unknown>;
  const placeName = str(f.place_name);
  const geom = f.geometry as Record<string, unknown> | undefined;
  const coordinates = Array.isArray(geom?.coordinates) ? (geom!.coordinates as number[]) : [];
  const lng = coordinates.length >= 2 ? coordinates[0] : undefined;
  const lat = coordinates.length >= 2 ? coordinates[1] : undefined;

  if (placeName) {
    let city = "";
    let state = "CA";
    let zip = "";
    const ctx = f.context;
    if (Array.isArray(ctx)) {
      for (const item of ctx) {
        if (!item || typeof item !== "object") continue;
        const o = item as Record<string, unknown>;
        const id = String(o.id ?? "");
        if (id.startsWith("place.")) city = str(o.text);
        if (id.startsWith("region.")) state = str(o.short_code) || str(o.text) || state;
        if (id.startsWith("postcode.")) zip = str(o.text);
      }
    }
    const streetLine = str(f.text) || placeName.split(",")[0]?.trim() || placeName;
    return {
      fullAddress: placeName.trim(),
      street: streetLine,
      city: city || "Unknown",
      state,
      zip,
      lat,
      lng,
    };
  }

  return mapboxRetrieveFeatureToAddressSelection(feature);
}

/** First feature from Mapbox `onRetrieve` payload, if present. */
export function mapboxRetrieveToAddressSelection(res: unknown): AddressSelection | null {
  const features = (res as { features?: unknown[] })?.features;
  const feature = Array.isArray(features) ? features[0] : undefined;
  return feature ? mapboxRetrieveFeatureToAddressSelection(feature) : null;
}

/**
 * Mapbox Search Box API — programmatic suggestions.
 * @see https://docs.mapbox.com/api/search/search-box/
 */
export const mapboxProvider: AddressSearchProvider = {
  providerName: "mapbox",

  async searchAddresses(query: string, options?: AddressSearchOptions): Promise<AddressPrediction[]> {
    if (!query.trim()) return [];

    const sessionToken = options?.sessionToken?.trim();
    if (!sessionToken) return [];

    const url = mapboxSuggestRequestUrl();
    if (url.hostname.includes("api.mapbox.com") && !MAPBOX_TOKEN) return [];
    url.searchParams.set("q", query.trim());
    url.searchParams.set("session_token", sessionToken);
    if (url.hostname.includes("api.mapbox.com")) {
      url.searchParams.set("access_token", MAPBOX_TOKEN);
      url.searchParams.set("language", "en");
      url.searchParams.set("country", "US");
      url.searchParams.set("types", "address");
      url.searchParams.set("limit", "10");
    }

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error("Mapbox address search failed");

    const json = (await res.json()) as { suggestions?: unknown[] };
    const suggestions = json?.suggestions ?? [];

    return suggestions.map((item, i) => {
      const it = item as Record<string, unknown>;
      const placeFormatted = it.place_formatted;
      const cityFromPlace =
        typeof placeFormatted === "string" ? placeFormatted.split(",")[0]?.trim() : undefined;
      return {
        id: String(it.mapbox_id ?? it.id ?? `mapbox-${i}`),
        label: String(it.full_address ?? it.name ?? ""),
        street: it.address != null ? String(it.address) : undefined,
        city: cityFromPlace,
        raw: item,
      };
    });
  },

  async resolveSelection(
    prediction: AddressPrediction,
    options: { sessionToken: string }
  ): Promise<AddressSelection> {
    const sessionToken = options.sessionToken.trim();
    const mapboxId = prediction.id.trim();
    if (!sessionToken || !mapboxId) return mapboxProvider.normalizeSelection(prediction);

    const url = mapboxRetrieveRequestUrl(mapboxId);
    if (url.hostname.includes("api.mapbox.com") && !MAPBOX_TOKEN) {
      return mapboxProvider.normalizeSelection(prediction);
    }
    url.searchParams.set("session_token", sessionToken);
    if (url.hostname.includes("api.mapbox.com")) {
      url.searchParams.set("access_token", MAPBOX_TOKEN);
    }

    const res = await fetch(url.toString());
    if (!res.ok) return mapboxProvider.normalizeSelection(prediction);

    const json = (await res.json()) as { features?: unknown[] };
    const feature = json?.features?.[0];
    const resolved = mapboxRetrieveFeatureToAddressSelection(feature);
    return resolved ?? mapboxProvider.normalizeSelection(prediction);
  },

  normalizeSelection(prediction: AddressPrediction): AddressSelection {
    const raw = prediction.raw as Record<string, unknown> | undefined;
    const ctx = raw?.context as Record<string, unknown> | undefined;
    const place = ctx?.place as Record<string, unknown> | undefined;
    const region = ctx?.region as Record<string, unknown> | undefined;
    const postcode = ctx?.postcode as Record<string, unknown> | undefined;
    const coords = raw?.coordinates as Record<string, unknown> | undefined;

    const lat =
      typeof coords?.latitude === "number"
        ? coords.latitude
        : typeof prediction.lat === "number"
          ? prediction.lat
          : undefined;
    const lng =
      typeof coords?.longitude === "number"
        ? coords.longitude
        : typeof prediction.lng === "number"
          ? prediction.lng
          : undefined;

    return {
      fullAddress: String(raw?.full_address ?? prediction.label),
      street:
        raw?.address_line1 != null
          ? String(raw.address_line1)
          : raw?.address != null
            ? String(raw.address)
            : prediction.street,
      city: place?.name != null ? String(place.name) : prediction.city ?? "Unknown",
      state:
        (region?.region_code != null ? String(region.region_code) : "") ||
        (region?.name != null ? String(region.name) : "") ||
        prediction.state ||
        "CA",
      zip: postcode?.name != null ? String(postcode.name) : prediction.zip ?? "",
      lat,
      lng,
    };
  },
};