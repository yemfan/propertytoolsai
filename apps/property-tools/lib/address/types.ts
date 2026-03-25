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

/** Pluggable address search (Mapbox, Google, etc.). */
export type AddressSearchProvider = {
  providerName: "mapbox" | "google";
  searchAddresses: (query: string) => Promise<AddressPrediction[]>;
  normalizeSelection: (prediction: AddressPrediction) => AddressSelection;
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
