import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

/**
 * Lazy cookie-backed browser client (same as `supabaseBrowser()`).
 * Prefer importing `supabaseBrowser` directly in new code.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = supabaseBrowser();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
  },
});
