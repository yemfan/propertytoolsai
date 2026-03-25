import type { AddressPrediction, AddressSearchProvider, AddressSelection } from "./types";

/**
 * Matches the payload from `components/AddressAutocomplete` (`AddressAutocompleteValue`)
 * and typical Google Places detail responses.
 */
export type GoogleAutocompleteValue = {
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
  placeId?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

export function googleAutocompleteValueToAddressSelection(v: GoogleAutocompleteValue): AddressSelection {
  const full = v.formattedAddress.trim();
  const primaryLine = full.split(",")[0]?.trim() || full;
  return {
    fullAddress: full,
    street: primaryLine,
    city: v.city?.trim() || "Unknown",
    state: v.state?.trim() || "",
    zip: v.zip?.trim() ?? "",
    lat: v.lat ?? undefined,
    lng: v.lng ?? undefined,
  };
}

function byComponent(
  components: { types: string[]; long_name: string; short_name?: string }[] | undefined,
  type: string
): string {
  return components?.find((c) => c.types.includes(type))?.long_name ?? "";
}

/** Google Geocoding `result` object → {@link AddressSelection}. */
export function googleGeocodeResultToAddressSelection(result: unknown): AddressSelection | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const formatted = String(r.formatted_address ?? "").trim();
  if (!formatted) return null;
  const components = r.address_components as
    | { types: string[]; long_name: string; short_name?: string }[]
    | undefined;
  const streetNumber = byComponent(components, "street_number");
  const route = byComponent(components, "route");
  const street = [streetNumber, route].filter(Boolean).join(" ").trim();
  const city =
    byComponent(components, "locality") ||
    byComponent(components, "sublocality") ||
    byComponent(components, "neighborhood");
  const state = byComponent(components, "administrative_area_level_1");
  const zip = byComponent(components, "postal_code");
  const loc = (r.geometry as { location?: { lat: number; lng: number } })?.location;
  return {
    fullAddress: formatted,
    street: street || undefined,
    city: city || "Unknown",
    state: state || "",
    zip: zip || "",
    lat: loc?.lat,
    lng: loc?.lng,
  };
}

/**
 * Programmatic search via {@link AddressSearchProvider} — stub until Places Autocomplete Data API
 * or the new widget flow is wired. Return shape matches {@link AddressPrediction} for callers.
 */
export const googleProvider: AddressSearchProvider = {
  providerName: "google",

  async searchAddresses(query: string): Promise<AddressPrediction[]> {
    const q = query.trim();
    if (!q) return [];

    const url = new URL("/api/address/autocomplete", window.location.origin);
    url.searchParams.set("q", q);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error("Google address search failed");

    const json = (await res.json()) as { predictions?: unknown[] };
    const predictions = Array.isArray(json?.predictions) ? json.predictions : [];

    return predictions.map((item, index) => {
      const it = (item ?? {}) as Record<string, unknown>;
      const placeId = typeof it.place_id === "string" ? it.place_id : `google-${index}`;
      const description = typeof it.description === "string" ? it.description : "";
      const sf =
        it.structured_formatting && typeof it.structured_formatting === "object"
          ? (it.structured_formatting as Record<string, unknown>)
          : null;
      const mainText = sf && typeof sf.main_text === "string" ? sf.main_text : undefined;
      const secondaryText = sf && typeof sf.secondary_text === "string" ? sf.secondary_text : undefined;

      const terms = Array.isArray(it.terms) ? (it.terms as Array<Record<string, unknown>>) : [];
      const city = typeof terms[1]?.value === "string" ? terms[1].value : undefined;
      const state = typeof terms[2]?.value === "string" ? terms[2].value : undefined;

      return {
        id: placeId,
        label: description || mainText || "",
        street: mainText,
        city,
        state,
        raw: item,
      };
    });
  },

  normalizeSelection(prediction: AddressPrediction): AddressSelection {
    return {
      fullAddress: prediction.label,
      street: prediction.street,
      city: prediction.city || "Unknown",
      state: prediction.state || "CA",
      zip: prediction.zip || "",
      lat: prediction.lat,
      lng: prediction.lng,
    };
  },
};