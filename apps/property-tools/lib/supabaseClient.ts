import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAuthCookieOptions } from "@/lib/authCookieOptions";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const cookieOptions = supabaseAuthCookieOptions();

/**
 * Browser Supabase client (anon key, cookie-backed session for SSR alignment).
 * For server-only writes with elevated privileges, use `@/lib/supabaseServer`.
 */
export const supabase: SupabaseClient = createBrowserClient(url, anon, {
  ...(cookieOptions ? { cookieOptions } : {}),
});
