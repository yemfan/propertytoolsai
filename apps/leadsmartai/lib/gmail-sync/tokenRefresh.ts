import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getGmailOAuthConfig, GMAIL_PROVIDER } from "./config";

/**
 * Returns a valid access_token for the agent's Gmail connection,
 * refreshing via the refresh_token if the current one is expired.
 *
 * Returns null if the agent isn't connected, has no refresh_token,
 * or the refresh call fails (token revoked / permissions removed).
 * Callers should treat that as "disconnected" and skip the sync run.
 *
 * Why not a shared Google OAuth helper: the Calendar flow uses its
 * own inline fetches and we want Gmail-vs-Calendar token state to
 * stay auditable and independent. A unified `oauthClient.ts`
 * abstraction is worthwhile later; in this PR we copy-with-intent.
 */
export async function getFreshGmailAccessToken(
  agentId: string,
): Promise<{ accessToken: string; accountEmail: string | null } | null> {
  const { data: row } = await supabaseAdmin
    .from("agent_oauth_tokens")
    .select(
      "access_token, refresh_token, expires_at, gmail_account_email, gmail_sync_enabled",
    )
    .eq("agent_id", agentId)
    .eq("provider", GMAIL_PROVIDER)
    .maybeSingle();

  const token = row as {
    access_token: string | null;
    refresh_token: string | null;
    expires_at: string | null;
    gmail_account_email: string | null;
    gmail_sync_enabled: boolean;
  } | null;

  if (!token?.access_token) return null;
  if (token.gmail_sync_enabled === false) return null;

  // Not expired yet (with a 60s safety buffer) → reuse as-is.
  if (
    token.expires_at &&
    new Date(token.expires_at).getTime() > Date.now() + 60_000
  ) {
    return {
      accessToken: token.access_token,
      accountEmail: token.gmail_account_email,
    };
  }

  if (!token.refresh_token) return null;

  const { clientId, clientSecret } = getGmailOAuthConfig();
  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const refreshData = (await refreshRes.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!refreshRes.ok || !refreshData.access_token) {
    // Refresh failed — probably revoked. Mark the row as errored so
    // the UI can surface "reconnect" without deleting the token
    // (which would let the agent re-consent cleanly).
    await supabaseAdmin
      .from("agent_oauth_tokens")
      .update({
        gmail_last_sync_error:
          refreshData.error || "refresh_token_rejected",
        updated_at: new Date().toISOString(),
      })
      .eq("agent_id", agentId)
      .eq("provider", GMAIL_PROVIDER);
    return null;
  }

  const newExpiresAt = refreshData.expires_in
    ? new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
    : null;

  await supabaseAdmin
    .from("agent_oauth_tokens")
    .update({
      access_token: refreshData.access_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("agent_id", agentId)
    .eq("provider", GMAIL_PROVIDER);

  return {
    accessToken: refreshData.access_token,
    accountEmail: token.gmail_account_email,
  };
}
