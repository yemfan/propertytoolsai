/**
 * Canonical site origin for metadata (`metadataBase`), Open Graph, and absolute URLs.
 *
 * **Production:** Set `NEXT_PUBLIC_SITE_URL` in Vercel (e.g. `https://propertytoolsai.com`).
 * **Preview:** Uses `VERCEL_URL` when unset so icons load from the preview URL.
 *
 * Values without a scheme are normalized to `https://…` so `new URL()` never throws.
 */
const DEFAULT_ORIGIN = "https://propertytoolsai.com";

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
