import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getGmailOAuthConfig, GMAIL_PROVIDER } from "@/lib/gmail-sync/config";

/**
 * GET /api/auth/google-gmail/callback
 *   Google redirects here after the agent consents. We exchange the
 *   code for tokens, pull the Gmail account email via the userinfo
 *   endpoint (so we can label the connection in the UI), and upsert
 *   into `agent_oauth_tokens` with provider='google_mail'.
 */
export async function GET(req: Request) {
  const { baseUrl } = getGmailOAuthConfig();
  const errRedirect = (code: string) =>
    NextResponse.redirect(`${baseUrl}/dashboard/settings?gmail_error=${encodeURIComponent(code)}`);
  const okRedirect = () =>
    NextResponse.redirect(`${baseUrl}/dashboard/settings?gmail_connected=1`);

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const agentId = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    if (errorParam) return errRedirect(errorParam);
    if (!code || !agentId) return errRedirect("missing_code");

    const { clientId, clientSecret, redirectUri } = getGmailOAuthConfig();

    // ── Exchange code for tokens ─────────────────────────────────
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      token_type?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
      error_description?: string;
    };
    if (!tokenRes.ok || !tokenData.access_token) {
      const msg = tokenData.error_description || tokenData.error || "token_exchange_failed";
      return errRedirect(msg);
    }

    // ── Fetch the account email so we can label the UI ───────────
    let accountEmail: string | null = null;
    try {
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userRes.ok) {
        const info = (await userRes.json()) as { email?: string };
        accountEmail = info.email ?? null;
      }
    } catch {
      // Not fatal — we can still sync without the label.
    }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    const { error: dbErr } = await supabaseServer
      .from("agent_oauth_tokens")
      .upsert(
        {
          agent_id: agentId,
          provider: GMAIL_PROVIDER,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token ?? null,
          token_type: tokenData.token_type ?? "Bearer",
          expires_at: expiresAt,
          scope: tokenData.scope ?? null,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          gmail_account_email: accountEmail,
          gmail_sync_enabled: true,
          // history_id stays null — first sync will bootstrap from
          // the most recent N messages (see sync.ts).
          gmail_history_id: null,
          gmail_last_sync_error: null,
        },
        { onConflict: "agent_id,provider" },
      );

    if (dbErr) {
      console.error("[google-gmail callback] token upsert error:", dbErr);
      return errRedirect("save_failed");
    }

    return okRedirect();
  } catch (e) {
    console.error("[google-gmail callback] unexpected:", e);
    return errRedirect("server_error");
  }
}
