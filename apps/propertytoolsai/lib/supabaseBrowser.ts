import { createBrowserClient } from "@supabase/ssr";
import { supabaseAuthCookieOptions } from "@/lib/authCookieOptions";
import { requireSupabasePublicEnv } from "@/lib/supabasePublicEnv";

/**
 * Browser Supabase client — must use `@supabase/ssr` so the session is stored in
 * cookies. The plain `createClient` from `supabase-js` uses localStorage only,
 * so Server Components (`supabaseServerClient` + `cookies()`) never see the user
 * and protected routes redirect to /login on every navigation.
 */
export function supabaseBrowser() {
  const { url: supabaseUrl, anonKey } = requireSupabasePublicEnv();
  const cookieOptions = supabaseAuthCookieOptions();
  return createBrowserClient(supabaseUrl, anonKey, {
    ...(cookieOptions ? { cookieOptions } : {}),
  });
}

