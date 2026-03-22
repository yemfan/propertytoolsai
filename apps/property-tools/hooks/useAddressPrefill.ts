"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "propertytoolsai:lastAddress";

export type SavedAddress = {
  formattedAddress: string;
  lat?: number | null;
  lng?: number | null;
  placeId?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

export type UseAddressPrefillOptions = {
  /**
   * When true, never hydrate from `propertytoolsai:lastAddress` (only URL `?address=` or empty).
   * Use with Google Places so the field isn’t pre-filled from the app’s “last address” cache.
   */
  skipLocalStorage?: boolean;
};

/**
 * URL `?address=` wins over localStorage. LocalStorage is read once on mount
 * (not when the user clears the field), unless `skipLocalStorage` is set.
 */
export function useAddressPrefill(
  queryAddress?: string | null,
  options?: UseAddressPrefillOptions
) {
  const skipLocalStorage = options?.skipLocalStorage ?? false;
  const urlAddress = queryAddress?.trim() ?? "";
  const [address, setAddressState] = useState(urlAddress);
  const [hydrated, setHydrated] = useState(false);
  const storageLoadedRef = useRef(false);

  useEffect(() => {
    if (urlAddress) {
      setAddressState(urlAddress);
    }
  }, [urlAddress]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (storageLoadedRef.current) return;
    storageLoadedRef.current = true;

    if (urlAddress) {
      setHydrated(true);
      return;
    }

    if (skipLocalStorage) {
      setHydrated(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedAddress;
        if (parsed?.formattedAddress) {
          setAddressState(parsed.formattedAddress);
        }
      }
    } catch {
      // ignore corrupted local cache
    } finally {
      setHydrated(true);
    }
  }, [urlAddress, skipLocalStorage]);

  const setAddress = useCallback(
    (next: string | ((prev: string) => string)) => {
      setAddressState((prev) =>
        typeof next === "function" ? next(prev) : next
      );
    },
    []
  );

  const saveSelectedAddress = useCallback((val: SavedAddress) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
    } catch {
      // ignore storage failures
    }
  }, []);

  return { address, setAddress, saveSelectedAddress, hydrated };
}
