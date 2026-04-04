/**
 * Canonical site origin for metadata and OAuth redirects.
 *
 * **Production:** Set `NEXT_PUBLIC_SITE_URL` in Vercel (e.g. `https://www.propertytoolsai.com`) so
 * Supabase `redirectTo` matches Authentication → URL Configuration → Redirect URLs exactly
 * (including apex vs `www`).
 *
 * **Local dev:** When unset, OAuth uses `window.location.origin` from the browser.
 */
const DEFAULT_ORIGIN = "https://www.propertytoolsai.com";

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
    return "http://localhost:3001";
  }
  return DEFAULT_ORIGIN;
}

/**
 * Base URL for Supabase OAuth `redirectTo` (Google / Apple).
 * Must match an entry under Supabase → Authentication → URL Configuration → Redirect URLs.
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
