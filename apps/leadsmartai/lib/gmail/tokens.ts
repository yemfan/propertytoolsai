import { supabaseServer } from "@/lib/supabaseServer";
import { getGmailOAuthConfig, GMAIL_PROVIDER_KEY } from "./config";

/**
 * Token lifecycle helpers for Gmail. Mirrors the calendar-side
 * functions in lib/google-calendar/sync.ts but keeps Gmail logic
 * separate so we can iterate on inbound-email plumbing without
 * touching the calendar sync code.
 *
 * What's here today:
 *   - isGmailConnected(agentId)
 *   - getGmailAccessToken(agentId) — returns a fresh access token,
 *     refreshing automatically if the stored one expired
 *
 * What's NOT here yet (Phase 2):
 *   - listMessages(agentId, query)
 *   - getMessageBody(agentId, messageId)
 *   - markAsRead / addLabel — those need the gmail.modify scope.
 */

type TokenRow = {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
};

export async function isGmailConnected(agentId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("agent_oauth_tokens")
    .select("id")
    .eq("agent_id", agentId as any)
    .eq("provider", GMAIL_PROVIDER_KEY)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Fetch a fresh access_token for the agent, refreshing through
 * Google's OAuth endpoint if the stored token is within 60 seconds
 * of expiry. Returns null when:
 *   - the agent never connected Gmail
 *   - the refresh_token was revoked / lost (agent must reconnect)
 */
export async function getGmailAccessToken(agentId: string): Promise<string | null> {
  const { data, error } = await supabaseServer
    .from("agent_oauth_tokens")
    .select("access_token, refresh_token, expires_at, scope")
    .eq("agent_id", agentId as any)
    .eq("provider", GMAIL_PROVIDER_KEY)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as TokenRow;

  // 60s safety margin — refresh slightly before expiry so we don't
  // race a request that takes ~500ms.
  const expiresAtMs = row.expires_at ? Date.parse(row.expires_at) : 0;
  const stillValid = expiresAtMs > Date.now() + 60_000;
  if (stillValid && row.access_token) return row.access_token;

  if (!row.refresh_token) {
    // Stored token expired and we can't refresh — agent has to
    // reconnect. Returning null surfaces this to callers.
    return null;
  }

  const { clientId, clientSecret } = getGmailOAuthConfig();
  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const refreshData = await refreshRes.json().catch(() => ({}));
  if (!refreshRes.ok || !refreshData.access_token) {
    console.error("[gmail.tokens] refresh failed", refreshData);
    return null;
  }

  const newAccess = String(refreshData.access_token);
  const newExpiresAt = refreshData.expires_in
    ? new Date(Date.now() + Number(refreshData.expires_in) * 1000).toISOString()
    : null;

  await supabaseServer
    .from("agent_oauth_tokens")
    .update({
      access_token: newAccess,
      expires_at: newExpiresAt,
      // Google doesn't usually re-issue refresh_token on refresh; only
      // overwrite if it actually came back, otherwise keep the existing
      // one so we don't lose offline access.
      ...(refreshData.refresh_token
        ? { refresh_token: String(refreshData.refresh_token) }
        : {}),
      updated_at: new Date().toISOString(),
    } as any)
    .eq("agent_id", agentId as any)
    .eq("provider", GMAIL_PROVIDER_KEY);

  return newAccess;
}
