import { NextResponse, type NextRequest } from "next/server";

// Proxy (Next.js 16+): access control at the edge of the app (replaces middleware.ts).
// - Protect dashboard pages
// - Do NOT protect API routes here (API routes return proper 401/402 JSON and
//   support bearer-token auth). Redirects here break API clients.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const protectedPagePrefixes = ["/dashboard"];

  const isProtected = protectedPagePrefixes.some((p) => pathname.startsWith(p));

  if (!isProtected) return NextResponse.next();

  // Supabase cookie name typically looks like: sb-<project_ref>-auth-token
  const hasAuthCookie = req.cookies.getAll().some((c) =>
    /sb-.*-auth-token/.test(c.name)
  );

  if (hasAuthCookie) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("redirect", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
