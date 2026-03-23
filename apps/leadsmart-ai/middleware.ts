import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAuthCookieOptions } from "@/lib/authCookieOptions";
import { PRODUCT_LEADSMART_AGENT } from "@/lib/entitlements/product";
import { getSupabasePublicEnv } from "@/lib/supabasePublicEnv";
import { matchesPortalKind } from "@/lib/rolePortalPaths";

function isAgentPath(pathname: string) {
  return pathname === "/agent" || pathname.startsWith("/agent/");
}

function isLoanBrokerPath(pathname: string) {
  return pathname === "/loan-broker" || pathname.startsWith("/loan-broker/");
}

function isSupportPath(pathname: string) {
  return pathname === "/support" || pathname.startsWith("/support/");
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isAuthPage(pathname: string) {
  return ["/login", "/signup"].includes(pathname);
}

export async function middleware(req: NextRequest) {
  const env = getSupabasePublicEnv();
  if (!env) {
    return NextResponse.next();
  }

  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const cookieOptions = supabaseAuthCookieOptions();

  const supabase = createServerClient(env.url, env.anonKey, {
    ...(cookieOptions ? { cookieOptions } : {}),
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;
  const search = req.nextUrl.search;

  const protectedPath =
    isAgentPath(pathname) ||
    isLoanBrokerPath(pathname) ||
    isSupportPath(pathname) ||
    isAdminPath(pathname) ||
    pathname.startsWith("/account/") ||
    pathname.startsWith("/propertytools/dashboard");

  if (protectedPath && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${pathname}${search || ""}`);
    return NextResponse.redirect(url);
  }

  if (isAuthPage(pathname) && user) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard-router";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Strict admin / support trees — only `admin` + `support` roles (layout uses `ensurePortalAccess("admin")`)
  if ((isAdminPath(pathname) || isSupportPath(pathname)) && user) {
    const { data: adminProfile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const adminRole = adminProfile?.role ?? null;
    if (!matchesPortalKind(adminRole, "admin")) {
      const url = req.nextUrl.clone();
      url.pathname = "/unauthorized";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Soft entitlement redirect for agent workspace (aligns with `hasAgentWorkspaceAccess` admin bypass)
  if (isAgentPath(pathname) && user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const role = String(profile?.role ?? "").toLowerCase().trim();
    if (role === "admin") {
      return res;
    }

    const { data: entitlement } = await supabase
      .from("active_product_entitlements")
      .select("id, product, is_active")
      .eq("user_id", user.id)
      .eq("product", PRODUCT_LEADSMART_AGENT)
      .maybeSingle();

    if (!entitlement) {
      const url = req.nextUrl.clone();
      url.pathname = "/start-free/agent";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/agent",
    "/agent/:path*",
    "/loan-broker",
    "/loan-broker/:path*",
    "/support",
    "/support/:path*",
    "/admin",
    "/admin/:path*",
    "/account/:path*",
    "/propertytools/dashboard/:path*",
    "/login",
    "/signup",
  ],
};
