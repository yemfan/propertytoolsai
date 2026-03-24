import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAuthCookieOptions } from "./lib/authCookieOptions";
import { getSupabasePublicEnv } from "./lib/supabasePublicEnv";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/dashboard-router",
  "/rbac",
  "/agent",
  "/loan-broker",
  "/support",
  "/admin",
  "/propertytools/dashboard",
];

const AUTH_PAGES = ["/login", "/signup"];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isAuthPage(pathname: string) {
  return AUTH_PAGES.includes(pathname);
}

/**
 * Proxy (Next.js 16+): Supabase cookie session refresh + auth gate for RBAC routes.
 * @see docs/RBAC.md
 */
export async function proxy(req: NextRequest) {
  let supabaseResponse = NextResponse.next({ request: req });
  const { pathname, search } = req.nextUrl;
  const protectedPath = isProtectedPath(pathname);
  const authPage = isAuthPage(pathname);

  const publicEnv = getSupabasePublicEnv();
  if (!publicEnv) {
    console.warn(
      "[property-tools proxy] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — add apps/property-tools/.env.local (see .env.example)."
    );
    if (protectedPath) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname + (req.nextUrl.search ?? ""));
      return NextResponse.redirect(url);
    }
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (protectedPath && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${pathname}${search || ""}`);
    return NextResponse.redirect(url);
  }

  if (authPage && user) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/dashboard-router",
    "/dashboard-router/:path*",
    "/rbac",
    "/rbac/:path*",
    "/admin",
    "/admin/:path*",
    "/agent",
    "/agent/:path*",
    "/loan-broker",
    "/loan-broker/:path*",
    "/support",
    "/support/:path*",
    "/propertytools/dashboard",
    "/propertytools/dashboard/:path*",
    "/login",
    "/signup",
  ],
};
