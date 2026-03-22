import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAuthCookieOptions } from "./lib/authCookieOptions";
import { getSupabasePublicEnv } from "./lib/supabasePublicEnv";

// Proxy (Next.js 16+): edge session refresh + dashboard protection.
// - Refresh Supabase cookies via getUser() so Server Components see the session.
// - Do NOT protect API routes here (they return JSON + support bearer auth).
export async function proxy(req: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: req,
  });

  const { pathname } = req.nextUrl;
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname === "/portal" ||
    pathname.startsWith("/portal/");

  const publicEnv = getSupabasePublicEnv();
  if (!publicEnv) {
    console.warn(
      "[property-tools proxy] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — add apps/property-tools/.env.local (see .env.example)."
    );
    if (isProtected) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const cookieOptions = supabaseAuthCookieOptions();

  const supabase = createServerClient(
    publicEnv.url,
    publicEnv.anonKey,
    {
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
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtected && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/portal", "/portal/:path*"],
};
