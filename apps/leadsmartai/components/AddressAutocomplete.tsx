"use client";

import { Loader } from "@googlemaps/js-api-loader";
import { useEffect, useMemo, useRef } from "react";

export type AddressAutocompleteValue = {
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
  /**
   * Parsed `address_components` so callers don't have to ask for separate
   * city/state/zip inputs. State uses the 2-letter short_name. Any field
   * that Google didn't return for the chosen Place comes back null.
   */
  components: {
    streetNumber: string | null;
    streetName: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
};

/**
 * Extract a value from a `google.maps.places.PlaceResult.address_components`
 * array given a target type (e.g. "locality", "postal_code"). Returns null
 * when no component of that type is present.
 */
function pickAddressComponent(
  components: google.maps.GeocoderAddressComponent[] | undefined,
  type: string,
  preferShort = false,
): string | null {
  const found = components?.find((c) => c.types.includes(type));
  if (!found) return null;
  const value = preferShort ? found.short_name : found.long_name;
  return value?.trim() || null;
}

type Props = {
  value: string;
  onChange: (next: string) => void;
  onSelect?: (val: AddressAutocompleteValue) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

let loaderPromise: Promise<void> | null = null;

function loadGooglePlaces(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  const loader = new Loader({
    apiKey,
    version: "weekly",
    libraries: ["places"],
  });

  // `@googlemaps/js-api-loader` types may not always expose `.load()` correctly.
  // Cast to `any` to keep TS happy while still calling the real method.
  loaderPromise = (loader as any).load().then(() => undefined) as Promise<void>;
  return loaderPromise;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "123 Main St, City, State",
  className,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  const ready = useMemo(() => Boolean(apiKey), [apiKey]);

  useEffect(() => {
    if (!ready) return;
    if (!inputRef.current) return;

    let cancelled = false;

    (async () => {
      await loadGooglePlaces(apiKey);
      if (cancelled) return;
      if (!inputRef.current) return;

      if (autocompleteRef.current) return;

      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        // Request address_components so we can split the chosen Place
        // into city / state / zip without a second geocode round trip.
        fields: ["formatted_address", "geometry", "address_components"],
        types: ["address"],
      });

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace();
        const formatted = place?.formatted_address ?? inputRef.current?.value ?? "";
        const lat = place?.geometry?.location?.lat?.() ?? null;
        const lng = place?.geometry?.location?.lng?.() ?? null;
        const ac = place?.address_components;

        const components = {
          streetNumber: pickAddressComponent(ac, "street_number"),
          streetName: pickAddressComponent(ac, "route"),
          city:
            pickAddressComponent(ac, "locality") ??
            pickAddressComponent(ac, "sublocality_level_1") ??
            pickAddressComponent(ac, "sublocality"),
          // 2-letter abbreviation for US states ("CA"), short_name on the
          // administrative_area_level_1 component.
          state: pickAddressComponent(ac, "administrative_area_level_1", true),
          zip: pickAddressComponent(ac, "postal_code"),
        };

        onChange(formatted);
        onSelect?.({ formattedAddress: formatted, lat, lng, components });
      });
    })().catch((e) => {
      console.error("Failed to load Google Places:", e);
    });

    return () => {
      cancelled = true;
    };
  }, [apiKey, onChange, onSelect, ready]);

  // If API key isn't configured, behave like a normal input.
  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      autoComplete="street-address"
    />
  );
}

