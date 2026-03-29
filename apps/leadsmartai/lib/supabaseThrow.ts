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
