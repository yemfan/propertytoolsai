import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getGmailOAuthConfig, GMAIL_PROVIDER_KEY } from "@/lib/gmail/config";

/**
 * GET /api/auth/gmail/callback
 *
 * Google redirects here after the user consents on
 * accounts.google.com. We exchange the authorization code for
 * access + refresh tokens and persist them against the agent.
 *
 * Errors bounce back to the dashboard with a `?gmail_error=` query
 * param the connect page can render.
 */
export async function GET(req: Request) {
  const { baseUrl } = getGmailOAuthConfig();
  // Where to send the agent after success/failure. Until there's a
  // dedicated /dashboard/inbox surface, land back on the calendar
  // page (the existing "Connections" surface for Google integrations).
  const returnPath = "/dashboard/calendar";

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const agentId = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        `${baseUrl}${returnPath}?gmail_error=${encodeURIComponent(error)}`,
      );
    }
    if (!code || !agentId) {
      return NextResponse.redirect(`${baseUrl}${returnPath}?gmail_error=missing_code`);
    }

    const { clientId, clientSecret, redirectUri } = getGmailOAuthConfig();

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

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      const errMsg =
        tokenData.error_description || tokenData.error || "token_exchange_failed";
      return NextResponse.redirect(
        `${baseUrl}${returnPath}?gmail_error=${encodeURIComponent(errMsg)}`,
      );
    }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    const { error: dbErr } = await supabaseServer
      .from("agent_oauth_tokens")
      .upsert(
        {
          agent_id: agentId as any,
          provider: GMAIL_PROVIDER_KEY,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token ?? null,
          token_type: tokenData.token_type ?? "Bearer",
          expires_at: expiresAt,
          scope: tokenData.scope ?? null,
          // calendar_id is calendar-specific; leave null for Gmail rows.
          calendar_id: null,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "agent_id,provider" },
      );

    if (dbErr) {
      console.error("Gmail token upsert error:", dbErr);
      return NextResponse.redirect(`${baseUrl}${returnPath}?gmail_error=save_failed`);
    }

    return NextResponse.redirect(`${baseUrl}${returnPath}?gmail_connected=1`);
  } catch (e: any) {
    console.error("Gmail callback error:", e);
    return NextResponse.redirect(`${baseUrl}${returnPath}?gmail_error=server_error`);
  }
}
