import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  getGmailOAuthConfig,
  GMAIL_SCOPES,
  isGmailConfigured,
} from "@/lib/gmail/config";

/**
 * GET /api/auth/gmail
 * Redirects the agent to Google's OAuth consent screen for Gmail.
 *
 * Same flow as /api/auth/google-calendar — agent_id is passed via
 * the OAuth `state` parameter so the callback can persist the tokens
 * against the right agent.
 */
export async function GET() {
  try {
    if (!isGmailConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Gmail integration not configured." },
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
      // `offline` so we get a refresh_token. Without it, tokens stop
      // working an hour after the consent flow.
      access_type: "offline",
      // `consent` forces the consent screen even if previously granted —
      // ensures Google issues a refresh_token on every connect.
      prompt: "consent",
      state: String(agentId),
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return NextResponse.redirect(url);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
