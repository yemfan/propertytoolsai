import { supabaseBrowser } from "@/lib/supabaseBrowser";

/**
 * Browser Supabase client (`@supabase/ssr` + cookie-backed session).
 *
 * Delegates to {@link supabaseBrowser} so auth uses the same `cookieOptions`
 * (per-app storage key, optional shared domain) as the server client.
 *
 * Do not use raw `createClient` from `supabase-js` in the browser here — it would
 * use localStorage and break SSR/session sync.
 */
export function createClient() {
  return supabaseBrowser();
}
