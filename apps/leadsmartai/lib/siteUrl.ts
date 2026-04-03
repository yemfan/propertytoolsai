/**
 * Canonical site origin for metadata (`metadataBase`) so favicons and Open Graph URLs match the deployment host.
 *
 * **Production:** Set `NEXT_PUBLIC_SITE_URL` in Vercel (e.g. `https://leadsmart-ai.com`).
 * **Preview:** Uses `VERCEL_URL` when unset so icons load from the preview origin, not production.
 *
 * Values without a scheme (e.g. `leadsmart-ai.com`) are normalized to `https://…` so `new URL()` never throws.
 */
const DEFAULT_ORIGIN = "https://leadsmart-ai.com";

function normalizeOrigin(raw: string, fallback: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) return fallback;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return fallback;
    return u.origin;
  } catch {
    return fallback;
  }
}

export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    return normalizeOrigin(fromEnv, DEFAULT_ORIGIN);
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return normalizeOrigin(`https://${vercel}`, DEFAULT_ORIGIN);
  }
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }
  return DEFAULT_ORIGIN;
}

/**
 * Base URL for Supabase OAuth `redirectTo` (Google / Apple). Must match an entry under
 * Supabase → Authentication → URL Configuration → **Redirect URLs** (e.g. `https://your-domain.com/auth/callback`).
 *
 * **Production:** Set `NEXT_PUBLIC_SITE_URL` on the host (e.g. Vercel) to your public `https://…` origin so
 * the callback never falls back to localhost when env or Supabase Site URL is misconfigured.
 *
 * **Local dev:** When `NEXT_PUBLIC_SITE_URL` is unset, uses `window.location.origin` (typically `http://localhost:3000`).
 */
export function getOAuthRedirectOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    return normalizeOrigin(fromEnv, DEFAULT_ORIGIN);
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return DEFAULT_ORIGIN;
}
