/**
 * Gmail OAuth configuration. Mirrors lib/google-calendar/config.ts.
 *
 * Why a separate client (and separate env vars) from Calendar?
 *   - Calendar is a non-controversial scope that doesn't trigger
 *     Google's restricted-scope verification (CASA assessment etc.).
 *   - Gmail's `gmail.readonly` IS restricted. Agents adopt it later
 *     and on a different timeline. Splitting the OAuth clients lets
 *     us roll Gmail through verification without touching the
 *     already-shipping Calendar integration.
 *
 * Env vars (set in Vercel):
 *   GMAIL_CLIENT_ID
 *   GMAIL_CLIENT_SECRET
 * Plus the existing NEXT_PUBLIC_APP_URL / APP_BASE_URL for the
 * redirect base (shared with Calendar).
 */
export function getGmailOAuthConfig() {
  const clientId = process.env.GMAIL_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GMAIL_CLIENT_SECRET?.trim() || "";
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    "https://www.leadsmart-ai.com"
  ).replace(/\/$/, "");
  const redirectUri = `${baseUrl}/api/auth/gmail/callback`;

  return { clientId, clientSecret, redirectUri, baseUrl };
}

/**
 * Read-only is enough for Phase 1 (intent classification + extracting
 * offers / listing agreements / showing requests). Switch to
 * `gmail.modify` later when we want to mark messages as read after
 * processing or apply labels (`processed-by-leadsmart`, etc.) — the
 * `modify` scope subsumes `readonly` so existing tokens get a free
 * upgrade after the consent flow re-runs.
 */
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

/**
 * Provider key used for the agent_oauth_tokens row. Calendar uses
 * `"google"`; Gmail intentionally uses `"google_gmail"` so the two
 * tokens don't collide on the (agent_id, provider) primary key.
 * If we ever migrate Calendar's provider to `"google_calendar"`,
 * keep this constant in sync.
 */
export const GMAIL_PROVIDER_KEY = "google_gmail" as const;

export function isGmailConfigured(): boolean {
  const { clientId, clientSecret } = getGmailOAuthConfig();
  return Boolean(clientId && clientSecret);
}
