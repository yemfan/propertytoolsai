import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getGoogleOAuthConfig, GOOGLE_CALENDAR_SCOPES, isGoogleCalendarConfigured } from "@/lib/google-calendar/config";

/**
 * GET /api/auth/google-calendar
 * Redirects the agent to Google's OAuth consent screen.
 */
export async function GET() {
  try {
    if (!isGoogleCalendarConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Google Calendar integration not configured." },
        { status: 503 }
      );
    }

    const { agentId } = await getCurrentAgentContext();
    const { clientId, redirectUri } = getGoogleOAuthConfig();

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_CALENDAR_SCOPES,
      access_type: "offline",
      // prompt=consent was previously here to force re-consent on every
      // connect (guaranteed refresh_token), but it triggered Google's
      // `secure-response-handling` policy rejection in the era when
      // the project's consent screen included a restricted Gmail
      // scope. Gmail OAuth has since been removed (replaced by the
      // forwarding-address pattern in lib/inbound/), so the scope
      // mix is now back to "sensitive only" (Calendar). We keep
      // `select_account` for the cleaner UX (account picker without
      // re-consent); access_type=offline still gets us a refresh
      // token on first consent.
      prompt: "select_account",
      include_granted_scopes: "true",
      state: agentId, // pass agentId through state for callback
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return NextResponse.redirect(url);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
