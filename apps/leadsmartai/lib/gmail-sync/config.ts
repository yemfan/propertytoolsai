/**
 * Shared config for Gmail sync. Separate from google-calendar config
 * so that agents can connect one without the other and we can
 * upgrade scopes independently.
 *
 * Env vars:
 *   GOOGLE_GMAIL_CLIENT_ID / GOOGLE_GMAIL_CLIENT_SECRET — a Google
 *     Cloud OAuth client. For dev you can reuse the Calendar client
 *     (just enable the Gmail API in that project + re-run consent).
 *     Production should use its own client because Gmail readonly is
 *     a restricted scope and requires app verification.
 */

export function getGmailOAuthConfig() {
  // Fall back to the Calendar credentials in dev so a single Google
  // Cloud OAuth client works for both integrations. In production
  // you'd override these with Gmail-specific creds after app
  // verification.
  const clientId =
    process.env.GOOGLE_GMAIL_CLIENT_ID?.trim() ||
    process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() ||
    "";
  const clientSecret =
    process.env.GOOGLE_GMAIL_CLIENT_SECRET?.trim() ||
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() ||
    "";
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    "https://www.leadsmart-ai.com"
  ).replace(/\/$/, "");
  const redirectUri = `${baseUrl}/api/auth/google-gmail/callback`;

  return { clientId, clientSecret, redirectUri, baseUrl };
}

/**
 * `.readonly` is Google's narrowest Gmail scope that still lets us
 * read subject + body. `.metadata` alone wouldn't give us body for
 * the CRM log. We deliberately don't request `.modify` or `.send`
 * in this MVP — outbound-from-CRM lives in a follow-up PR so each
 * scope change gets its own consent screen + verification review.
 */
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email", // to label the connection in UI
].join(" ");

export const GMAIL_PROVIDER = "google_mail" as const;

export function isGmailSyncConfigured(): boolean {
  const { clientId, clientSecret } = getGmailOAuthConfig();
  return Boolean(clientId && clientSecret);
}
