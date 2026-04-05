/**
 * Shared cron-request authentication for LeadSmart AI.
 *
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` on every invocation.
 * We also accept `?secret=<CRON_SECRET>` for manual curl-based testing.
 *
 * If CRON_SECRET is not set (local dev), verification is skipped.
 */
export function verifyCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;

  const auth = req.headers.get("authorization");
  const url = new URL(req.url);
  const q = url.searchParams.get("secret");
  return auth === `Bearer ${secret}` || q === secret;
}
