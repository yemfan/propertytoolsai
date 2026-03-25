import { useMemo } from "react";
import type { AddressSearchProvider } from "./types";
import { googleProvider } from "./google";
import { mapboxProvider } from "./mapbox";

/**
 * Which autocomplete stack is configured (env-driven).
 * Consumers can pick UI or fall back to plain text + {@link parseTypedAddress}.
 */
export type AddressProviderId = "mapbox" | "google";

const providerEnv = (process.env.NEXT_PUBLIC_ADDRESS_PROVIDER ?? "mapbox").trim().toLowerCase();

/** Programmatic address search + normalization ({@link AddressSearchProvider}). */
export function getAddressProvider(): AddressSearchProvider {
  if (providerEnv === "google") return googleProvider;
  return mapboxProvider;
}

/** Stable {@link AddressSearchProvider} for client components (env resolved at build/runtime). */
export function useAddressProvider(): AddressSearchProvider {
  return useMemo(() => getAddressProvider(), []);
}

export type AddressAutocompleteEnv = {
  mapboxAccessToken: string;
  googleMapsApiKey: string;
};

export function readAddressAutocompleteEnv(): AddressAutocompleteEnv {
  return {
    mapboxAccessToken: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? "",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "",
  };
}

export function hasMapboxAddressAutocomplete(env: AddressAutocompleteEnv = readAddressAutocompleteEnv()): boolean {
  return Boolean(env.mapboxAccessToken);
}

export function hasGoogleAddressAutocomplete(env: AddressAutocompleteEnv = readAddressAutocompleteEnv()): boolean {
  return Boolean(env.googleMapsApiKey);
}
