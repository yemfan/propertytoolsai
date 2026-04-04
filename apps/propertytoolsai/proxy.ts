import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAuthCookieOptions } from "@/lib/authCookieOptions";
import { getRoleHomePath, parseUserRole } from "@/lib/auth/roles";
import { getSupabasePublicEnv } from "@/lib/supabasePublicEnv";
import { safeInternalRedirect } from "@/lib/loginUrl";

function getRequiredRole(pathname: string): "agent" | "loan_broker" | "support" | "admin" | null {
  if (pathname.startsWith("/agent")) return "agent";
  if (pathname.startsWith("/loan-broker")) return "loan_broker";
  if (pathname.startsWith("/support")) return "support";
  if (pathname.startsWith("/admin")) return "admin";
  return null;
}

function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/agent") ||
    pathname.startsWith("/loan-broker") ||
    pathname.startsWith("/support") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/dashboard-router") ||
    pathname.startsWith("/rbac") ||
    pathname.startsWith("/propertytools/dashboard")
  );
}

/**
 * Next.js 16+ request proxy: Supabase session + RBAC (replaces legacy middleware.ts).
 */
export async function proxy(request: NextRequest) {
  const publicEnv = getSupabasePublicEnv();
  if (!publicEnv) {
    if (isProtectedPath(request.nextUrl.pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search || ""}`);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const cookieOptions = supabaseAuthCookieOptions();

  const supabase = createServerClient(publicEnv.url, publicEnv.anonKey, {
    ...(cookieOptions ? { cookieOptions } : {}),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  if (isAuthPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const protectedPath = isProtectedPath(pathname);
  if (!protectedPath) {
    return response;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search || ""}`);
    return NextResponse.redirect(url);
  }

  const { data: upRow } = await supabase
    .from("user_profiles")
    .select("leadsmart_users(role)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!upRow) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search || ""}`);
    url.searchParams.set("reason", "missing_profile");
    return NextResponse.redirect(url);
  }

  const lsRaw = (upRow as { leadsmart_users?: { role?: string } | { role?: string }[] }).leadsmart_users;
  const ls = lsRaw == null ? null : Array.isArray(lsRaw) ? lsRaw[0] : lsRaw;
  const dbRole = ls?.role ?? "user";
  const role = parseUserRole(dbRole);

  if (pathname === "/dashboard") {
    const redirectTarget =
      safeInternalRedirect(request.nextUrl.searchParams.get("redirect")) ??
      safeInternalRedirect(request.nextUrl.searchParams.get("next"));
    if (redirectTarget) {
      return NextResponse.redirect(new URL(redirectTarget, request.url));
    }
    return NextResponse.redirect(new URL(getRoleHomePath(role), request.url));
  }

  const requiredRole = getRequiredRole(pathname);
  if (requiredRole) {
    const allowed = role === requiredRole || role === "admin";
    if (!allowed) {
      return NextResponse.redirect(new URL(getRoleHomePath(role), request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/dashboard-router",
    "/dashboard-router/:path*",
    "/rbac",
    "/rbac/:path*",
    "/agent",
    "/agent/:path*",
    "/loan-broker",
    "/loan-broker/:path*",
    "/support",
    "/support/:path*",
    "/admin",
    "/admin/:path*",
    "/propertytools/dashboard",
    "/propertytools/dashboard/:path*",
    "/login",
    "/signup",
  ],
};
