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
      // working an hour after the consent flow. Google issues a
      // refresh_token on the FIRST consent for a (client, scope, user)
      // tuple — additional consents only return one when prompt=consent
      // is set.
      access_type: "offline",
      // `prompt=select_account` lets the user pick which Google account
      // to use without forcing re-consent. Was previously prompt=consent,
      // which triggered Google's `secure-response-handling` policy
      // rejection in Testing-mode + restricted-scope projects (a known
      // documented edge case). select_account avoids the rejection but
      // still walks the user through scope grants on first connect.
      prompt: "select_account",
      // `include_granted_scopes` so successive connects accumulate scopes
      // rather than replacing — important because the same Google account
      // may already have granted Calendar scope to a sibling client and
      // we don't want to clobber that.
      include_granted_scopes: "true",
      state: String(agentId),
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return NextResponse.redirect(url);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
