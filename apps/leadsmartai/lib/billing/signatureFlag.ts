/**
 * Soft-launch gate for the Signature tier.
 *
 * Default OFF. Flip `NEXT_PUBLIC_FEATURE_SIGNATURE_TIER` to `"true"` in
 * the Vercel project env (per-environment) to expose Signature
 * publicly. Removed entirely when the soft launch ends.
 *
 * Two escape hatches for testers while the flag is off:
 *   1. Query param: visit `?signature_preview=1` once — sets a
 *      sessionStorage value + a short-lived cookie so subsequent
 *      navigation keeps Signature visible.
 *   2. Cookie: `lsai_sig_preview=1` lets the server-side checkout
 *      endpoint accept a Signature plan even when the env var is
 *      off. This is what lets a tester actually complete a Signature
 *      checkout during preview.
 *
 * The cookie is intentionally simple (no signing) — the only thing a
 * spoofed cookie enables is seeing the same Signature tier you'd
 * see once we flip the flag for everyone. No security implications.
 */

export const SIGNATURE_PREVIEW_QUERY_PARAM = "signature_preview";
export const SIGNATURE_PREVIEW_STORAGE_KEY = "leadsmart_signature_preview_v1";
export const SIGNATURE_PREVIEW_COOKIE_NAME = "lsai_sig_preview";
export const SIGNATURE_PREVIEW_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function envFlagOn(): boolean {
  return String(process.env.NEXT_PUBLIC_FEATURE_SIGNATURE_TIER ?? "")
    .trim()
    .toLowerCase() === "true";
}

/**
 * Client-only: should the Signature card render on this page load?
 * Reads the env flag (build-time inlined) + sessionStorage preview
 * value. Safe to call from React effects + render-time gating.
 */
export function isSignatureTierVisibleClient(): boolean {
  if (envFlagOn()) return true;
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(SIGNATURE_PREVIEW_STORAGE_KEY) === "1") return true;
  } catch {
    // private mode — fall through
  }
  // Cookie fallback in case sessionStorage was nuked but the cookie
  // survived (the inverse of the storage-cleared / cookie-set case).
  try {
    return document.cookie
      .split(";")
      .map((c) => c.trim())
      .some((c) => c === `${SIGNATURE_PREVIEW_COOKIE_NAME}=1`);
  } catch {
    return false;
  }
}

/**
 * Client helper — call this on mount of any pricing surface so the
 * `?signature_preview=1` URL param activates preview mode. Idempotent.
 */
export function activateSignaturePreviewFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get(SIGNATURE_PREVIEW_QUERY_PARAM) !== "1") return;
    try {
      sessionStorage.setItem(SIGNATURE_PREVIEW_STORAGE_KEY, "1");
    } catch {
      // sessionStorage unavailable
    }
    try {
      document.cookie =
        `${SIGNATURE_PREVIEW_COOKIE_NAME}=1; path=/; max-age=${SIGNATURE_PREVIEW_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    } catch {
      // ignore
    }
  } catch {
    // URL parse failure — nothing to do
  }
}

/**
 * Server-only: should the checkout endpoint accept a `plan: "signature"`
 * request? Reads the env flag + the preview cookie from request
 * headers. Pass the raw `cookie` header (e.g. from `req.headers.get('cookie')`).
 */
export function isSignatureTierAllowedServer(rawCookieHeader: string | null): boolean {
  if (envFlagOn()) return true;
  if (!rawCookieHeader) return false;
  return rawCookieHeader
    .split(";")
    .map((c) => c.trim())
    .some((c) => c === `${SIGNATURE_PREVIEW_COOKIE_NAME}=1`);
}
