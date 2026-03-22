"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

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
  /** Extra classes for the outer wrapper (e.g. Zillow-style search shell). */
  wrapperClassName?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  /** Show magnifying-glass affordance (consumer / Zillow-style). Default true. */
  showSearchIcon?: boolean;
  /** Minimum characters before requesting Places (Zillow-like: 2). */
  minChars?: number;
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

/** Normalize for comparing Google vs React-controlled value (spaces, NBSP). */
function normAddr(s: string) {
  return s.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
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

/** Zillow-style: primary line + locality (Places structured_formatting). */
function formatPredictionLines(p: google.maps.places.AutocompletePrediction) {
  const sf = p.structured_formatting;
  if (sf?.main_text) {
    return {
      primary: sf.main_text,
      secondary: sf.secondary_text ?? "",
    };
  }
  const parts = p.description.split(",");
  if (parts.length <= 1) {
    return { primary: p.description, secondary: "" };
  }
  return {
    primary: parts[0]?.trim() ?? p.description,
    secondary: parts.slice(1).join(",").trim(),
  };
}

const DEBOUNCE_MS = 180;

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.2-4.2" />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 21s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10z" />
      <circle cx="12" cy="11" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  onBlur,
  placeholder = "Search for an address, neighborhood, city, or ZIP",
  className,
  wrapperClassName,
  disabled,
  required,
  name,
  id,
  showSearchIcon = true,
  minChars = 2,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  /** When set, we just applied this normalized string from a suggestion — don't re-fetch/reopen the dropdown. Cleared when the user types. */
  const committedSelectionRef = useRef<string | null>(null);
  /** Block prediction fetch briefly after a pick (handles Strict Mode + async getDetails). */
  const suppressPredictionsUntilMsRef = useRef(0);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const autoServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  /** Session token: pair predictions + details for Places billing (Google recommendation). */
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [placesReady, setPlacesReady] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  /** Non-fatal hint when predictions are empty (e.g. ZERO_RESULTS) — distinct from REQUEST_DENIED. */
  const [placesHint, setPlacesHint] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const ready = useMemo(() => Boolean(apiKey), [apiKey]);
  const missingKey = !apiKey;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setPlacesReady(false);
    setPlacesError(null);
    setPlacesHint(null);

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
    if (query.length < minChars) {
      setPredictions([]);
      setOpen(false);
      return;
    }

    if (Date.now() < suppressPredictionsUntilMsRef.current) {
      setPredictions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    const nq = normAddr(query);
    if (committedSelectionRef.current !== null && nq === committedSelectionRef.current) {
      setPredictions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    const t = setTimeout(() => {
      const svc = autoServiceRef.current;
      if (!svc) return;

      setLoading(true);
      setPlacesHint(null);

      const token = sessionTokenRef.current ?? new google.maps.places.AutocompleteSessionToken();
      sessionTokenRef.current = token;

      svc.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: "us" },
          /** Streets, cities, ZIPs — consumer real-estate search (Zillow-like), not random businesses. */
          types: ["geocode"],
          sessionToken: token,
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
              "Places request denied. In Google Cloud → Credentials → your browser key: enable Places API + Maps JavaScript API, billing, and HTTP referrer restrictions that include this exact origin (e.g. http://localhost:3000/* and http://localhost:3001/* — match the port shown in your address bar)."
            );
            setPredictions([]);
            setActiveIndex(-1);
            setOpen(false);
            return;
          }

          if (status === google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT) {
            setPlacesError(
              "Google Places quota exceeded for this key. Check billing and Places API quotas in Google Cloud Console."
            );
            setPredictions([]);
            setActiveIndex(-1);
            setOpen(false);
            return;
          }

          if (status !== google.maps.places.PlacesServiceStatus.OK || !res?.length) {
            if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
              setPlacesHint("No matches yet — try a street number, city, or ZIP.");
            } else if (status !== google.maps.places.PlacesServiceStatus.OK) {
              setPlacesHint(`Address lookup returned ${String(status)}. Check the browser console and Google Cloud API status.`);
            } else {
              setPlacesHint(null);
            }
            setPredictions([]);
            setActiveIndex(-1);
            setOpen(false);
            return;
          }
          setPlacesHint(null);
          setPredictions(res);
          setActiveIndex(0);
          setOpen(true);
        }
      );
    }, DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [value, ready, disabled, placesReady, minChars]);

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

  function newSessionToken() {
    sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
  }

  function selectPrediction(prediction: google.maps.places.AutocompletePrediction) {
    setOpen(false);
    setPredictions([]);
    setActiveIndex(-1);

    const optimistic = prediction.description;
    committedSelectionRef.current = normAddr(optimistic);
    suppressPredictionsUntilMsRef.current = Date.now() + 2800;
    onChange(optimistic);

    const places = placesServiceRef.current;
    const token = sessionTokenRef.current;

    if (!places) {
      newSessionToken();
      onSelect?.({
        formattedAddress: prediction.description,
        lat: null,
        lng: null,
        placeId: prediction.place_id ?? null,
      });
      return;
    }

    places.getDetails(
      {
        placeId: prediction.place_id,
        fields: ["formatted_address", "geometry", "address_components", "place_id"],
        sessionToken: token ?? undefined,
      },
      (place, status) => {
        newSessionToken();

        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          committedSelectionRef.current = normAddr(prediction.description);
          onSelect?.({
            formattedAddress: prediction.description,
            lat: null,
            lng: null,
            placeId: prediction.place_id ?? null,
          });
          return;
        }

        const formatted = place.formatted_address ?? prediction.description;
        const lat = place.geometry?.location?.lat?.() ?? null;
        const lng = place.geometry?.location?.lng?.() ?? null;
        const { city, state, zip } = pickAddressParts(place);

        committedSelectionRef.current = normAddr(formatted);
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

  const inputClasses = cn(
    "w-full rounded-xl border border-slate-200 bg-white py-3 text-[15px] leading-snug text-slate-900 shadow-sm transition-shadow placeholder:text-slate-400 focus:border-[#0072ce] focus:outline-none focus:ring-2 focus:ring-[#0072ce]/20",
    className,
    showSearchIcon && "pl-10 pr-3",
    loading && "pr-10"
  );

  return (
    <div className={cn("relative", wrapperClassName)} ref={containerRef}>
      {showSearchIcon ? (
        <span
          className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-slate-400"
          aria-hidden
        >
          <SearchIcon className={loading ? "opacity-40" : ""} />
        </span>
      ) : null}
      {loading ? (
        <span
          className="pointer-events-none absolute right-3 top-1/2 z-[1] -translate-y-1/2"
          aria-hidden
        >
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-[#0072ce]" />
        </span>
      ) : null}

      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        value={value}
        onChange={(e) => {
          committedSelectionRef.current = null;
          suppressPredictionsUntilMsRef.current = 0;
          onChange(e.target.value);
        }}
        onBlur={() => onBlur?.()}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (predictions.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        className={inputClasses}
        disabled={disabled}
        required={required}
        name={name ?? "pt-google-places-query"}
        id={id}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        data-lpignore="true"
        data-1p-ignore="true"
        data-form-type="other"
        aria-autocomplete="list"
        aria-expanded={open}
        role="combobox"
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

      {placesHint && !placesError ? (
        <p className="mt-1 text-xs text-slate-600" role="status">
          {placesHint}
        </p>
      ) : null}

      {open ? (
        <div
          className="absolute z-[9999] mt-1.5 max-h-[min(22rem,calc(100vh-8rem))] w-full overflow-y-auto rounded-2xl border border-slate-200/90 bg-white py-1 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/[0.04]"
          role="listbox"
        >
          {predictions.map((p, idx) => {
            const { primary, secondary } = formatPredictionLines(p);
            return (
              <button
                key={p.place_id}
                type="button"
                role="option"
                aria-selected={idx === activeIndex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectPrediction(p)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={cn(
                  "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors",
                  idx === activeIndex ? "bg-sky-50" : "hover:bg-slate-50"
                )}
              >
                <MapPinIcon className="mt-0.5 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-900">{primary}</span>
                  {secondary ? (
                    <span className="mt-0.5 block text-sm font-normal text-slate-500">{secondary}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
          <div className="border-t border-slate-100 px-3 py-1.5">
            <p className="text-[10px] leading-tight text-slate-400">Powered by Google</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
