import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAuthCookieOptions } from "./lib/authCookieOptions";
import { getSupabasePublicEnv } from "./lib/supabasePublicEnv";

// Proxy (Next.js 16+): edge session refresh when wired with a non-empty `matcher`.
// Matcher is empty — `/dashboard` was removed; refresh runs only if you re-enable routes here.
export async function proxy(req: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: req,
  });

  const publicEnv = getSupabasePublicEnv();
  if (!publicEnv) {
    console.warn(
      "[property-tools proxy] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — add apps/property-tools/.env.local (see .env.example)."
    );
    return supabaseResponse;
  }

  const cookieOptions = supabaseAuthCookieOptions();

  const supabase = createServerClient(publicEnv.url, publicEnv.anonKey, {
    ...(cookieOptions ? { cookieOptions } : {}),
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request: req,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [],
};
