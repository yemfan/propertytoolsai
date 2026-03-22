import { createBrowserClient } from "@supabase/ssr";
import { supabaseAuthCookieOptions } from "@/lib/authCookieOptions";

/**
 * Browser Supabase client — must use `@supabase/ssr` so the session is stored in
 * cookies. The plain `createClient` from `supabase-js` uses localStorage only,
 * so Server Components (`supabaseServerClient` + `cookies()`) never see the user
 * and protected routes redirect to /login on every navigation.
 */
export function supabaseBrowser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieOptions = supabaseAuthCookieOptions();
  return createBrowserClient(supabaseUrl, anonKey, {
    ...(cookieOptions ? { cookieOptions } : {}),
  });
}

