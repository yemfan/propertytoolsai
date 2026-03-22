import { createBrowserClient } from "@supabase/ssr";
import { supabaseAuthCookieOptions } from "@/lib/authCookieOptions";

/** Cookie-backed session so Server Components and `proxy.ts` see the same auth as the browser. */
export function supabaseBrowser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieOptions = supabaseAuthCookieOptions();
  return createBrowserClient(supabaseUrl, anonKey, {
    ...(cookieOptions ? { cookieOptions } : {}),
  });
}

