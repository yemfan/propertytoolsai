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
  throw new Error(msg || (code ? `${fallbackMessage} (${code})` : fallbackMessage));
}
