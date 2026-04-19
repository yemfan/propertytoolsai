/**
 * Micro-market signal cache — stores Walk Score, flood zone, and school
 * rating results keyed by lat/lng (rounded to 4 decimal places ≈ 11m).
 *
 * Avoids redundant API calls for the same property or nearby re-estimates.
 * Uses in-memory Map with 24-hour TTL (process-level cache).
 * Falls through to API on cache miss.
 */

import type { WalkScoreResult } from "./walkScore";
import type { FloodZoneResult } from "./floodZone";
import type { SchoolRatingResult } from "./schoolRatings";

export type MicroMarketCacheEntry = {
  walkScore?: WalkScoreResult;
  floodZone?: FloodZoneResult;
  schoolRating?: SchoolRatingResult;
  fetchedAt: number;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 500;

const cache = new Map<string, MicroMarketCacheEntry>();

/** Round to 4 decimal places (≈11m precision) for cache key. */
function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/** Get cached micro-market signals for a location. */
export function getCachedMicroMarket(
  lat: number,
  lng: number
): MicroMarketCacheEntry | null {
  const key = cacheKey(lat, lng);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry;
}

/** Store micro-market signals in cache. */
export function setCachedMicroMarket(
  lat: number,
  lng: number,
  data: Omit<MicroMarketCacheEntry, "fetchedAt">
): void {
  // Evict oldest entries if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }

  const key = cacheKey(lat, lng);
  cache.set(key, { ...data, fetchedAt: Date.now() });
}
