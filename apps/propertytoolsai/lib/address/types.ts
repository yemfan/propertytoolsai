/**
 * Canonical address shape for tools (home value, CMA, etc.).
 */
export type AddressSelection = {
  fullAddress: string;
  street?: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
};

/** Autocomplete / search suggestion before resolving to {@link AddressSelection}. */
export type AddressPrediction = {
  id: string;
  label: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lng?: number;
  raw?: unknown;
};

/** Options for {@link AddressSearchProvider.searchAddresses} (e.g. Mapbox Search Box session). */
export type AddressSearchOptions = {
  /** Required by Mapbox `/suggest` + `/retrieve`; reuse for all keystrokes in one pick flow. */
  sessionToken?: string;
};

/** Pluggable address search (Mapbox, Google, etc.). */
export type AddressSearchProvider = {
  providerName: "mapbox" | "google";
  searchAddresses: (query: string, options?: AddressSearchOptions) => Promise<AddressPrediction[]>;
  normalizeSelection: (prediction: AddressPrediction) => AddressSelection;
  /**
   * Mapbox Search Box: after `/suggest`, call `/retrieve` with the same `session_token` for coordinates + full props.
   */
  resolveSelection?: (
    prediction: AddressPrediction,
    options: { sessionToken: string }
  ) => Promise<AddressSelection>;
};

/** Parse a comma-separated typed address when autocomplete is not used. */
export function parseTypedAddress(input: string): AddressSelection | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 3) {
    const street = parts[0];
    const city = parts[1];
    const stateZip = parts[2].split(/\s+/).filter(Boolean);
    return {
      fullAddress: trimmed,
      street,
      city,
      state: stateZip[0] || "CA",
      zip: stateZip[1] || "",
    };
  }

  return {
    fullAddress: trimmed,
    street: trimmed,
    city: "Unknown",
    state: "CA",
    zip: "",
  };
}

/** @deprecated Use {@link parseTypedAddress} */
export const parseHomeValueAddressString = parseTypedAddress;
