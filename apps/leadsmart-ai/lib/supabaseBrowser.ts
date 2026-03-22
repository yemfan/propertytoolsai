import { createBrowserClient } from "@supabase/ssr";
import { supabaseAuthCookieOptions } from "@/lib/authCookieOptions";
import { requireSupabasePublicEnv } from "@/lib/supabasePublicEnv";

/** Cookie-backed session so Server Components and `proxy.ts` see the same auth as the browser. */
export function supabaseBrowser() {
  const { url: supabaseUrl, anonKey } = requireSupabasePublicEnv();
  const cookieOptions = supabaseAuthCookieOptions();
  return createBrowserClient(supabaseUrl, anonKey, {
    ...(cookieOptions ? { cookieOptions } : {}),
  });
}

