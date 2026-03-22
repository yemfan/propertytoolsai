import type { CookieOptions } from "@supabase/ssr";

/**
 * Optional: share Supabase session cookies across LeadSmart + Property Tools on the
 * same parent domain. Same env as the other app: `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=.yourdomain.com`
 *
 * @see docs/SHARED_AUTH.md (repo root)
 */
export function supabaseAuthCookieOptions(): CookieOptions | undefined {
  const domain = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN?.trim();
  if (!domain) return undefined;

  return {
    domain,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}
