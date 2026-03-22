import type { CookieOptions } from "@supabase/ssr";

/**
 * Optional: share Supabase session cookies across Property Tools + LeadSmart (and any
 * other app) on subdomains of the same parent domain.
 *
 * Set `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN` to e.g. `.yourdomain.com` (leading dot).
 * Omit locally when using two different localhost ports — browsers cannot share cookies across ports.
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
    // HTTPS in production; localhost is fine without secure in dev
    secure: process.env.NODE_ENV === "production",
  };
}
