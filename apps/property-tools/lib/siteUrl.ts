/**
 * Canonical site origin for metadata (`metadataBase`), Open Graph, and absolute URLs.
 *
 * **Production:** Set `NEXT_PUBLIC_SITE_URL` in Vercel to your live origin (e.g. `https://propertytoolsai.com`)
 * so favicons and `next/image` metadata resolve to the same host as the deployment.
 *
 * **Vercel preview:** `VERCEL_URL` is used when `NEXT_PUBLIC_SITE_URL` is unset so icons load from the preview URL.
 */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NODE_ENV === "development") return "http://localhost:3001";
  return "https://propertytoolsai.com";
}
