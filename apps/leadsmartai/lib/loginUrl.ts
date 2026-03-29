/** Only same-origin relative paths; blocks `//evil.com` open redirects. */
export function safeInternalRedirect(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

/**
 * After login, pricing auto-opens Stripe Checkout (Pro subscription with trial period).
 * Query is read by `app/pricing/page.tsx`.
 */
export const PRICING_TRIAL_CHECKOUT_PATH = "/pricing?trial_checkout=1";

/**
 * Builds `/login?redirect=…&reason=…` for post-auth return (open-redirect safe paths only).
 * The login page also accepts `next` as an alias for `redirect` (same semantics).
 */
export function loginUrl(opts: { redirect: string; reason?: "trial" | "checkout" }) {
  const p = new URLSearchParams();
  const path = opts.redirect.startsWith("/") ? opts.redirect : `/${opts.redirect}`;
  p.set("redirect", path);
  if (opts.reason) p.set("reason", opts.reason);
  return `/login?${p.toString()}`;
}
