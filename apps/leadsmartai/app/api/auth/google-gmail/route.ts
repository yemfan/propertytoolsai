import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  getGmailOAuthConfig,
  GMAIL_SCOPES,
  isGmailSyncConfigured,
} from "@/lib/gmail-sync/config";

/**
 * GET /api/auth/google-gmail
 *   Redirect to Google's OAuth consent for Gmail read access.
 *   Copy of the Calendar flow — different scopes + different
 *   callback path. State carries the agent id through the redirect
 *   so the callback knows who to bind the tokens to.
 */
export async function GET() {
  try {
    if (!isGmailSyncConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Gmail sync not configured (missing OAuth creds)." },
        { status: 503 },
      );
    }
    const { agentId } = await getCurrentAgentContext();
    const { clientId, redirectUri } = getGmailOAuthConfig();

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GMAIL_SCOPES,
      access_type: "offline", // long-lived refresh_token for the cron
      prompt: "consent", // force refresh_token even on re-consent
      state: String(agentId),
    });

    return NextResponse.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
