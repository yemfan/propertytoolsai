"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useMemo, useRef, useState } from "react";

export type AddressAutocompleteValue = {
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
  placeId?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

type Props = {
  value: string;
  onChange: (next: string) => void;
  onSelect?: (val: AddressAutocompleteValue) => void;
  /** Called when the field loses focus (e.g. persist typed address without picking a suggestion). */
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
};

let loadPlacesPromise: Promise<google.maps.PlacesLibrary> | null = null;
let loadPlacesKey: string | null = null;

/** @googlemaps/js-api-loader v2+ — use setOptions + importLibrary("places"). */
function loadPlacesLibrary(apiKey: string): Promise<google.maps.PlacesLibrary> {
  if (typeof window === "undefined") {
    return Promise.resolve({} as google.maps.PlacesLibrary);
  }
  if (loadPlacesPromise && loadPlacesKey === apiKey) return loadPlacesPromise;

  loadPlacesKey = apiKey;
  setOptions({
    key: apiKey,
    v: "weekly",
    libraries: ["places"],
  });

  loadPlacesPromise = importLibrary("places") as Promise<google.maps.PlacesLibrary>;
  return loadPlacesPromise;
}

function pickAddressParts(place: google.maps.places.PlaceResult) {
  const parts = place.address_components ?? [];
  const byType = (type: string) => parts.find((p) => p.types.includes(type))?.long_name ?? null;
  return {
    city: byType("locality") ?? byType("sublocality") ?? null,
    state: byType("administrative_area_level_1"),
    zip: byType("postal_code"),
  };
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  onBlur,
  placeholder = "123 Main St, City, State",
  className,
  disabled,
  required,
  name,
  id,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const autoServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [placesReady, setPlacesReady] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const ready = useMemo(() => Boolean(apiKey), [apiKey]);
  const missingKey = !apiKey;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setPlacesReady(false);
    setPlacesError(null);

    (async () => {
      try {
        const places = await loadPlacesLibrary(apiKey);
        if (cancelled) return;

        autoServiceRef.current = new places.AutocompleteService();
        const el = document.createElement("div");
        placesServiceRef.current = new places.PlacesService(el);
        setPlacesReady(true);
      } catch (e) {
        console.error("Failed to load Google Places:", e);
        if (!cancelled) {
          setPlacesError("Could not load Google Maps. Check the API key and Maps JavaScript API.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiKey, ready]);

  useEffect(() => {
    if (!ready || disabled || !placesReady) {
      if (!ready || disabled) {
        setPredictions([]);
        setOpen(false);
      }
      return;
    }

    const query = value.trim();
    if (query.length < 3) {
      setPredictions([]);
      setOpen(false);
      return;
    }

    const t = setTimeout(() => {
      const svc = autoServiceRef.current;
      if (!svc) return;

      setLoading(true);
      svc.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: "us" },
        },
        (res, status) => {
          setLoading(false);

          if (process.env.NODE_ENV === "development") {
            if (status !== google.maps.places.PlacesServiceStatus.OK) {
              console.warn("[AddressAutocomplete] getPlacePredictions status:", status);
            }
          }

          if (status === google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
            setPlacesError(
              "Places request denied. Enable Places API + Maps JavaScript API, billing, and HTTP referrer (e.g. localhost:3001/*) for this key."
            );
            setPredictions([]);
            setActiveIndex(-1);
            setOpen(false);
            return;
          }

          if (status !== google.maps.places.PlacesServiceStatus.OK || !res?.length) {
            setPredictions([]);
            setActiveIndex(-1);
            setOpen(false);
            return;
          }
          setPredictions(res);
          setActiveIndex(0);
          setOpen(true);
        }
      );
    }, 220);

    return () => clearTimeout(t);
  }, [value, ready, disabled, placesReady]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function selectPrediction(prediction: google.maps.places.AutocompletePrediction) {
    const places = placesServiceRef.current;
    if (!places) {
      onChange(prediction.description);
      onSelect?.({
        formattedAddress: prediction.description,
        lat: null,
        lng: null,
        placeId: prediction.place_id ?? null,
      });
      setOpen(false);
      return;
    }

    places.getDetails(
      {
        placeId: prediction.place_id,
        fields: ["formatted_address", "geometry", "address_components", "place_id"],
      },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          onChange(prediction.description);
          onSelect?.({
            formattedAddress: prediction.description,
            lat: null,
            lng: null,
            placeId: prediction.place_id ?? null,
          });
          setOpen(false);
          return;
        }

        const formatted = place.formatted_address ?? prediction.description;
        const lat = place.geometry?.location?.lat?.() ?? null;
        const lng = place.geometry?.location?.lng?.() ?? null;
        const { city, state, zip } = pickAddressParts(place);

        onChange(formatted);
        onSelect?.({
          formattedAddress: formatted,
          lat,
          lng,
          placeId: place.place_id ?? prediction.place_id ?? null,
          city,
          state,
          zip,
        });
        setOpen(false);
      }
    );
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || predictions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % predictions.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + predictions.length) % predictions.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const selected = predictions[activeIndex] ?? predictions[0];
      if (selected) selectPrediction(selected);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onBlur?.()}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (predictions.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        required={required}
        name={name}
        id={id}
        autoComplete="street-address"
      />

      {missingKey ? (
        <p className="mt-1 text-xs text-amber-700">
          Add{" "}
          <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to{" "}
          <code className="rounded bg-amber-100 px-1">.env.local</code> for address suggestions.
        </p>
      ) : null}

      {placesError ? (
        <p className="mt-1 text-xs text-red-700" role="alert">
          {placesError}
        </p>
      ) : null}

      {open ? (
        <div className="absolute z-[9999] mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {predictions.map((p, idx) => (
            <button
              key={p.place_id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectPrediction(p)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                idx === activeIndex ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {p.description}
            </button>
          ))}
          {loading ? <div className="px-3 py-2 text-xs text-slate-500">Loading...</div> : null}
        </div>
      ) : null}
    </div>
  );
}

