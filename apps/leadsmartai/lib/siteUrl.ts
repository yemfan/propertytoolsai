/**
 * Canonical site origin for metadata (`metadataBase`) so favicons and Open Graph URLs match the deployment host.
 *
 * **Production:** Set `NEXT_PUBLIC_SITE_URL` in Vercel (e.g. `https://leadsmart-ai.com`).
 * **Preview:** Uses `VERCEL_URL` when unset so icons load from the preview origin, not production.
 */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return "https://leadsmart-ai.com";
}
