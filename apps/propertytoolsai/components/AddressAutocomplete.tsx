"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { GoogleAutocompleteValue } from "@/lib/address/google";

/** @deprecated Import {@link GoogleAutocompleteValue} from `@/lib/address` instead. */
export type AddressAutocompleteValue = GoogleAutocompleteValue;

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
  return s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Extract `{ city, state, zip }` from the new Place API's
 * `addressComponents` (long-form: `longText` instead of legacy
 * `long_name`). The legacy locality / sublocality / postal-code
 * conventions still apply.
 */
function pickAddressParts(components: google.maps.places.AddressComponent[]) {
  const byType = (type: string) =>
    components.find((c) => c.types.includes(type))?.longText ?? null;
  return {
    city: byType("locality") ?? byType("sublocality") ?? null,
    state: byType("administrative_area_level_1"),
    zip: byType("postal_code"),
  };
}

/**
 * Normalized prediction row used throughout the component. Holds a
 * reference back to the underlying suggestion so we can resolve a
 * `Place` for details fetching when the user picks a row.
 */
type Prediction = {
  placeId: string;
  primary: string;
  secondary: string;
  description: string;
  suggestion: google.maps.places.AutocompleteSuggestion;
};

const DEBOUNCE_MS = 180;

/**
 * Real-estate-friendly equivalent of the legacy `types: ["geocode"]`
 * filter. The new Places API doesn't accept `geocode` as a primary
 * type, so we explicitly include the address-y types we want
 * (street addresses, routes, sub-premises, localities, ZIPs).
 */
const INCLUDED_PRIMARY_TYPES = [
  "street_address",
  "subpremise",
  "route",
  "locality",
  "postal_code",
];

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
  /** Session token: pair predictions + details for Places billing (Google recommendation). */
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  /**
   * Increments on every fetch so an in-flight request from a stale
   * keystroke can't overwrite predictions from a newer query. The
   * legacy callback API offered no cancellation; the new Promise
   * API doesn't either, so we gate on this counter at resolve time.
   */
  const requestSeqRef = useRef(0);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [placesReady, setPlacesReady] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  /** Non-fatal hint when predictions are empty (e.g. zero results). */
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
        // Just need the library loaded — the new API uses the
        // global `google.maps.places.AutocompleteSuggestion` and
        // `Place` classes directly, no per-instance services.
        await loadPlacesLibrary(apiKey);
        if (cancelled) return;
        setPlacesReady(true);
      } catch (e) {
        console.error("Failed to load Google Places:", e);
        if (!cancelled) {
          setPlacesError(
            "Could not load Google Maps. Check the API key and Maps JavaScript API.",
          );
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
      void fetchPredictions(query);
    }, DEBOUNCE_MS);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ready, disabled, placesReady, minChars]);

  /**
   * Fire a single prediction request via the new
   * `AutocompleteSuggestion.fetchAutocompleteSuggestions` API
   * (Promise-based; no callback/status tuple).
   */
  async function fetchPredictions(query: string) {
    const token =
      sessionTokenRef.current ??
      new google.maps.places.AutocompleteSessionToken();
    sessionTokenRef.current = token;

    const seq = ++requestSeqRef.current;
    setLoading(true);
    setPlacesHint(null);

    try {
      const { suggestions } =
        await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          includedPrimaryTypes: INCLUDED_PRIMARY_TYPES,
          includedRegionCodes: ["us"],
          sessionToken: token,
        });

      // Drop the response if the user has typed more characters
      // since this request was issued.
      if (seq !== requestSeqRef.current) return;

      const items: Prediction[] = suggestions
        .filter((s) => s.placePrediction != null)
        .map((s) => {
          const p = s.placePrediction!;
          const primary = p.mainText?.text ?? p.text?.text ?? "";
          const secondary = p.secondaryText?.text ?? "";
          return {
            placeId: p.placeId,
            primary,
            secondary,
            description: p.text?.text ?? `${primary}${secondary ? ", " + secondary : ""}`,
            suggestion: s,
          };
        });

      setLoading(false);

      if (items.length === 0) {
        setPlacesHint("No matches yet — try a street number, city, or ZIP.");
        setPredictions([]);
        setActiveIndex(-1);
        setOpen(false);
        return;
      }

      setPlacesHint(null);
      setPredictions(items);
      setActiveIndex(0);
      setOpen(true);
    } catch (e) {
      if (seq !== requestSeqRef.current) return;
      setLoading(false);
      setPredictions([]);
      setActiveIndex(-1);
      setOpen(false);

      const message = e instanceof Error ? e.message : String(e);
      const lower = message.toLowerCase();

      if (process.env.NODE_ENV === "development") {
        console.warn("[AddressAutocomplete] fetchAutocompleteSuggestions failed:", e);
      }

      if (
        lower.includes("denied") ||
        lower.includes("api key") ||
        lower.includes("referer") ||
        lower.includes("referrer") ||
        lower.includes("not authorized")
      ) {
        setPlacesError(
          "Places request denied. In Google Cloud → Credentials → your browser key: enable the Places API (New) + Maps JavaScript API, confirm billing is active, and add HTTP referrer restrictions that include this exact origin (e.g. https://propertytoolsai.com/* and https://www.propertytoolsai.com/*).",
        );
        return;
      }

      if (lower.includes("quota") || lower.includes("over_query_limit")) {
        setPlacesError(
          "Google Places quota exceeded for this key. Check billing and Places API (New) quotas in Google Cloud Console.",
        );
        return;
      }

      setPlacesHint(
        `Address lookup hit a transient error. Retrying as you type. (${message})`,
      );
    }
  }

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

  /**
   * Apply the selected prediction to the input + fetch its details
   * (formatted address, lat/lng, address components) via the new
   * `Place.fetchFields` API.
   */
  async function selectPrediction(prediction: Prediction) {
    setOpen(false);
    setPredictions([]);
    setActiveIndex(-1);

    const optimistic = prediction.description;
    committedSelectionRef.current = normAddr(optimistic);
    suppressPredictionsUntilMsRef.current = Date.now() + 2800;
    onChange(optimistic);

    const placePrediction = prediction.suggestion.placePrediction;
    if (!placePrediction) {
      newSessionToken();
      onSelect?.({
        formattedAddress: prediction.description,
        lat: null,
        lng: null,
        placeId: prediction.placeId || null,
      });
      return;
    }

    try {
      const place = placePrediction.toPlace();
      await place.fetchFields({
        fields: [
          "displayName",
          "formattedAddress",
          "location",
          "addressComponents",
          "id",
        ],
      });

      newSessionToken();

      const formatted = place.formattedAddress ?? prediction.description;
      const lat = place.location?.lat() ?? null;
      const lng = place.location?.lng() ?? null;
      const components = place.addressComponents ?? [];
      const { city, state, zip } = pickAddressParts(components);

      committedSelectionRef.current = normAddr(formatted);
      onChange(formatted);
      onSelect?.({
        formattedAddress: formatted,
        lat,
        lng,
        placeId: place.id ?? prediction.placeId ?? null,
        city,
        state,
        zip,
      });
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[AddressAutocomplete] place.fetchFields failed:", e);
      }
      newSessionToken();
      committedSelectionRef.current = normAddr(prediction.description);
      onSelect?.({
        formattedAddress: prediction.description,
        lat: null,
        lng: null,
        placeId: prediction.placeId || null,
      });
    }
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
      if (selected) void selectPrediction(selected);
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
          {predictions.map((p, idx) => (
            <button
              key={p.placeId}
              type="button"
              role="option"
              aria-selected={idx === activeIndex}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void selectPrediction(p)}
              onMouseEnter={() => setActiveIndex(idx)}
              className={cn(
                "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors",
                idx === activeIndex ? "bg-sky-50" : "hover:bg-slate-50"
              )}
            >
              <MapPinIcon className="mt-0.5 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-slate-900">{p.primary}</span>
                {p.secondary ? (
                  <span className="mt-0.5 block text-sm font-normal text-slate-500">
                    {p.secondary}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
          <div className="border-t border-slate-100 px-3 py-1.5">
            <p className="text-[10px] leading-tight text-slate-400">Powered by Google</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
