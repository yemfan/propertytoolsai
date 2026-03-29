"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { useAddressProvider } from "@/lib/address";
import { googleAutocompleteValueToAddressSelection } from "@/lib/address/google";
import type { AddressPrediction } from "@/lib/address/types";
import type { AddressSelection } from "@/lib/home-value/types";

/** Set to `true` to show the “Use my location” control again. */
const SHOW_USE_MY_LOCATION = false;

function newMapboxSessionToken(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: AddressSelection) => void;
  onSubmit: () => void;
  onUseMyLocation?: () => void;
  isBusy: boolean;
};

export function AddressAutocompleteInput({
  value,
  onChange,
  onSelect,
  onSubmit,
  onUseMyLocation,
  isBusy,
}: Props) {
  const provider = useAddressProvider();
  const isGoogle = provider.providerName === "google";
  const mapboxSessionRef = useRef<string>(newMapboxSessionToken());
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AddressPrediction[]>([]);

  useEffect(() => {
    if (isGoogle) return;

    let active = true;

    async function run() {
      if (!value.trim()) {
        setResults([]);
        return;
      }

      try {
        setLoading(true);
        const items = await provider.searchAddresses(value, {
          sessionToken: provider.providerName === "mapbox" ? mapboxSessionRef.current : undefined,
        });
        if (active) setResults(items);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    const t = setTimeout(() => {
      void run();
    }, 250);

    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [value, provider, isGoogle]);

  useEffect(() => {
    if (isGoogle) return;
    if (!value.trim()) {
      mapboxSessionRef.current = newMapboxSessionToken();
    }
  }, [value, isGoogle]);

  const showMenu = useMemo(
    () => !isGoogle && focused && (loading || results.length > 0),
    [focused, loading, results.length, isGoogle]
  );

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
      <div className="mx-auto max-w-4xl text-center">
        <div className="inline-flex rounded-full border bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
          PropertyToolsAI
        </div>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
          Estimate Your Home Value Instantly
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-gray-600 md:text-lg">
          Get a smart estimate, see a value range, and unlock a more detailed valuation report in minutes.
        </p>

        <div className="relative mx-auto mt-8 max-w-3xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-start">
            {isGoogle ? (
              <div className="min-w-0 flex-1 text-left">
                <AddressAutocomplete
                  value={value}
                  onChange={onChange}
                  onSelect={(v) => onSelect(googleAutocompleteValueToAddressSelection(v))}
                  placeholder="Enter property address"
                  wrapperClassName="w-full"
                  className="rounded-2xl border border-gray-200 px-5 py-4 text-sm shadow-sm outline-none focus:border-gray-400"
                  minChars={2}
                />
              </div>
            ) : (
              <div className="relative min-w-0 flex-1">
                <input
                  value={value}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setTimeout(() => setFocused(false), 150)}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder="Enter property address"
                  className={[
                    "w-full rounded-2xl border px-5 py-4 text-sm outline-none",
                    focused ? "border-gray-400" : "border-gray-200",
                  ].join(" ")}
                />

                {showMenu && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border bg-white text-left shadow-xl">
                    {loading ? (
                      <div className="px-4 py-3 text-sm text-gray-500">Searching…</div>
                    ) : (
                      results.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            void (async () => {
                              if (provider.resolveSelection) {
                                try {
                                  const addr = await provider.resolveSelection(item, {
                                    sessionToken: mapboxSessionRef.current,
                                  });
                                  onSelect(addr);
                                  return;
                                } catch {
                                  // fall through
                                }
                              }
                              onSelect(provider.normalizeSelection(item));
                            })();
                          }}
                          className="block w-full border-b px-4 py-3 text-sm text-gray-700 transition hover:bg-gray-50 last:border-b-0"
                        >
                          {item.label}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onSubmit}
              disabled={!value.trim() || isBusy}
              className="shrink-0 rounded-2xl bg-gray-900 px-6 py-4 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isBusy ? "Estimating..." : "Get Estimate"}
            </button>
          </div>

          {SHOW_USE_MY_LOCATION && onUseMyLocation ? (
            <div className="mt-3 flex justify-start">
              <button
                type="button"
                onClick={onUseMyLocation}
                className="rounded-full border bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Use my location
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-4 text-xs text-gray-400">
          Provider: {provider.providerName}
        </div>
      </div>
    </section>
  );
}
