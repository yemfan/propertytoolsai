import type { PostgrestError } from "@supabase/supabase-js";

/**
 * PostgREST `error` objects are plain objects. Throwing them from React Server Components
 * often produces cryptic production errors (digest only). Always throw a real `Error`.
 */
export function throwIfSupabaseError(
  error: PostgrestError | null,
  fallbackMessage = "Database request failed"
): asserts error is null {
  if (!error) return;
  const msg = typeof error.message === "string" ? error.message.trim() : "";
  const code = error.code;
  const details = typeof (error as { details?: string }).details === "string"
    ? String((error as { details?: string }).details).trim()
    : "";
  const hint = typeof (error as { hint?: string }).hint === "string"
    ? String((error as { hint?: string }).hint).trim()
    : "";
  const parts = [msg, code, details, hint].filter(Boolean);
  throw new Error(parts.length ? parts.join(" — ") : fallbackMessage);
}

/**
 * Client-safe: Supabase/PostgREST errors are often plain objects, not `Error` — `String(e)` becomes `[object Object]`.
 */
export function messageFromUnknownError(e: unknown, fallback = "Something went wrong."): string {
  if (e instanceof Error) return (e.message || fallback).trim() || fallback;
  if (typeof e === "string") return e.trim() || fallback;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim()) {
      const parts = [o.message.trim()];
      if (typeof o.details === "string" && o.details.trim()) parts.push(o.details.trim());
      if (typeof o.hint === "string" && o.hint.trim()) parts.push(o.hint.trim());
      if (typeof o.code === "string" && o.code.trim()) parts.push(`(${o.code})`);
      return parts.join(" — ");
    }
  }
  return fallback;
}
