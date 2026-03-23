import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAuthCookieOptions } from "./lib/authCookieOptions";
import { getSupabasePublicEnv } from "./lib/supabasePublicEnv";

export async function proxy(req: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: req,
  });

  const { pathname } = req.nextUrl;
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/broker") ||
    pathname.startsWith("/agent") ||
    pathname === "/portal" ||
    pathname.startsWith("/portal/");

  const publicEnv = getSupabasePublicEnv();
  if (!publicEnv) {
    console.warn(
      "[leadsmart-ai proxy] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — add apps/leadsmart-ai/.env.local (see .env.example)."
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
  matcher: [
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
    "/broker",
    "/broker/:path*",
    "/agent",
    "/agent/:path*",
    "/portal",
    "/portal/:path*",
  ],
};
