import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require an authenticated user + an org.
// Keep in sync with the (dashboard) route group in app/(dashboard)/*.
const DASHBOARD_SEGMENTS = [
  "/ask", "/automations", "/books", "/calendar", "/clients", "/home",
  "/inbox", "/marketing", "/pipeline", "/projects", "/reception", "/reports",
  "/settings", "/social", "/tasks", "/timesheets", "/voice",
];

// Routes only accessible when logged OUT
const AUTH_SEGMENTS = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Start with a passthrough response so Supabase can refresh cookies
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SMBAI_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SMBAI_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Validate session with Supabase (also refreshes expired tokens)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDashboard = DASHBOARD_SEGMENTS.some((seg) => pathname.startsWith(seg));
  const isAuth = AUTH_SEGMENTS.some((seg) => pathname.startsWith(seg));
  const isOnboarding = pathname.startsWith("/onboarding");

  // ── Dashboard routes ─────────────────────────────────────────────────────
  if (isDashboard) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Use cookie for fast org check — avoids DB on every request.
    // Cookie is set by createOrg() server action and onboarding page fallback.
    const orgId = request.cookies.get("smbai-org-id")?.value;
    if (!orgId) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  // ── Onboarding route ─────────────────────────────────────────────────────
  if (isOnboarding && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ── Auth routes (login / signup) ─────────────────────────────────────────
  if (isAuth && user) {
    const orgId = request.cookies.get("smbai-org-id")?.value;
    return NextResponse.redirect(
      new URL(orgId ? "/books" : "/onboarding", request.url)
    );
  }

  return response;
}

export const config = {
  // Skip static assets, images, and API routes
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|svg|jpg|jpeg|webp)$).*)"],
};
