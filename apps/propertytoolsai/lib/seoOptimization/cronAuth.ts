/**
 * Optional shared secret for cron / internal job routes.
 * Set CRON_SECRET in production; if unset, verification passes (local dev only).
 */
export function verifyCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;

  const auth = req.headers.get("authorization");
  const url = new URL(req.url);
  const q = url.searchParams.get("secret");
  return auth === `Bearer ${secret}` || q === secret;
}
