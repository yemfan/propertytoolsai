/**
 * AsyncStorage-based read cache. Pure TypeScript, no React hooks.
 *
 * Storage format per key: `JSON.stringify({ data, ts })` where `ts`
 * is the epoch-millisecond write timestamp. All functions silently
 * swallow JSON parse errors and return null.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "@ls_cache:";

type CacheEnvelope<T> = { data: T; ts: number };

export async function cacheWrite<T>(key: string, data: T): Promise<void> {
  try {
    const envelope: CacheEnvelope<T> = { data, ts: Date.now() };
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(envelope));
  } catch {
    // Best-effort — if storage is full we just skip the cache write.
  }
}

export async function cacheRead<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (raw === null) return null;
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    return envelope.data;
  } catch {
    return null;
  }
}

export async function cacheReadWithAge<T>(
  key: string
): Promise<{ data: T; ageMs: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (raw === null) return null;
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    return { data: envelope.data, ageMs: Date.now() - envelope.ts };
  } catch {
    return null;
  }
}

/**
 * Removes all cache entries (prefix-scoped). Intended for sign-out
 * cleanup so the next user doesn't see stale data.
 */
export async function cacheClear(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch {
    // Best-effort cleanup.
  }
}
