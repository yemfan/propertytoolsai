"use client";

import { Loader } from "@googlemaps/js-api-loader";
import { useEffect, useMemo, useRef } from "react";

export type AddressAutocompleteValue = {
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
};

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
        fields: ["formatted_address", "geometry"],
        types: ["address"],
      });

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace();
        const formatted = place?.formatted_address ?? inputRef.current?.value ?? "";
        const lat = place?.geometry?.location?.lat?.() ?? null;
        const lng = place?.geometry?.location?.lng?.() ?? null;

        onChange(formatted);
        onSelect?.({ formattedAddress: formatted, lat, lng });
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

