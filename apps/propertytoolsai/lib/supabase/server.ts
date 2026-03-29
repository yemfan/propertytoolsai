import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAuthCookieOptions } from "@/lib/authCookieOptions";
import { requireSupabasePublicEnv } from "@/lib/supabasePublicEnv";

/**
 * Server Supabase client for App Router (Route Handlers, Server Components, Server Actions).
 *
 * Matches the Supabase + Next.js `cookies()` pattern, and applies the same
 * `cookieOptions` as {@link supabaseServerClient} (per-app auth cookie name, etc.).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabasePublicEnv();
  const cookieOptions = supabaseAuthCookieOptions();

  return createServerClient(url, anonKey, {
    ...(cookieOptions ? { cookieOptions } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components / some contexts cannot set cookies — session refresh still works via middleware/proxy.
        }
      },
    },
  });
}
