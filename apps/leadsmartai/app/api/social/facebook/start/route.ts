import { NextResponse } from "next/server";

import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  buildFacebookAuthorizeUrl,
  generateOauthState,
  isFacebookOauthConfigFailure,
  loadFacebookOauthConfig,
} from "@/lib/social/facebookOauth";

export const runtime = "nodejs";

const STATE_COOKIE = "fb_oauth_state";

/**
 * GET /api/social/facebook/start
 *
 * Kicks off the Facebook OAuth dance:
 *   1. Verify the user is an authed agent.
 *   2. Generate a random state token; stash it in an HttpOnly cookie
 *      so the callback route can verify (CSRF protection).
 *   3. Redirect the browser to Facebook's authorize dialog.
 *
 * On config errors (missing META_APP_ID etc.) returns a JSON 500 the
 * settings UI can surface — better UX than a redirect to a broken
 * Facebook page.
 */
export async function GET() {
  try {
    await getCurrentAgentContext(); // 401s on unauth

    const cfg = loadFacebookOauthConfig();
    if (isFacebookOauthConfigFailure(cfg)) {
      return NextResponse.json({ ok: false, error: cfg.error }, { status: 500 });
    }

    const state = generateOauthState();
    const url = buildFacebookAuthorizeUrl({
      appId: cfg.config.appId,
      redirectUri: cfg.config.redirectUri,
      state,
    });

    const res = NextResponse.redirect(url);
    res.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api/social/facebook",
      maxAge: 600, // 10 minutes — OAuth dance should never take longer
    });
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
