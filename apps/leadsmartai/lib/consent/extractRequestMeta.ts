/**
 * Pure helpers for pulling the audit metadata (IP + user-agent) out of
 * a Next.js / Web Request. Lives separately from the persistence layer
 * so it can be unit-tested without touching Supabase.
 *
 * IP-resolution rules (in order):
 *   1. `x-forwarded-for` — first hop is the client. Vercel / most CDNs
 *      set this. We trim to the first comma-separated token.
 *   2. `x-real-ip` — some proxies use this instead.
 *   3. `cf-connecting-ip` — Cloudflare-specific.
 *
 * If none are present we return null rather than guessing — better to
 * log "ip unknown" than fabricate one. The audit row is still useful
 * with timestamp + UA + the disclosure version.
 *
 * NOTE on IPv6 + privacy: we store the full address. If we ever need
 * to anonymize for retention we can truncate the last 64 bits at write
 * time; doing it here would break detection of repeat-abuser patterns
 * which is exactly what the audit table needs to support.
 */

export type RequestMeta = {
  ipAddress: string | null;
  userAgent: string | null;
};

export function extractRequestMeta(req: Request): RequestMeta {
  const headers = req.headers;
  const ipAddress = pickFirstClientIp(headers);
  const userAgent = headers.get("user-agent")?.slice(0, 1024) ?? null;
  return { ipAddress, userAgent };
}

function pickFirstClientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const xRealIp = headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim().slice(0, 64);
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim().slice(0, 64);
  return null;
}
