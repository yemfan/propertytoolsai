import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { generateAuthorizeUrl, signState } from "@/lib/leads-gen/linkedin-oauth";

export const runtime = "nodejs";

/**
 * GET /api/leads-gen/connect/linkedin/start
 *
 * Initiates the LinkedIn OAuth flow. Same pattern as the Meta start
 * route: sign a state token bound to the agent, set it as a short-
 * lived HttpOnly cookie, redirect to LinkedIn's OAuth dialog.
 *
 * Scopes requested (see linkedin-oauth.ts): openid + profile + email
 * for the userinfo lookup, w_member_social for posting on the
 * member's behalf. None of these need partner-program approval.
 *
 * Plan gate: Pro or higher. LinkedIn organic posting is bundled
 * with the same Quick Post feature that gates Meta, so we mirror
 * that gate here.
 */
export async function GET() {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    if (auth.planType === "free") {
      return NextResponse.json(
        { ok: false, error: "Connecting LinkedIn requires Pro or higher." },
        { status: 402 },
      );
    }

    // Sign state bound to this agent so a stolen state token from
    // another session can't be replayed against our callback.
    const state = signState({
      nonce: crypto.randomBytes(16).toString("hex"),
      agentId: auth.agentId,
      issuedAt: Date.now(),
    });

    const url = generateAuthorizeUrl(state);
    const res = NextResponse.redirect(url, { status: 302 });
    // 10-minute cookie — covers the OAuth round-trip + a slow
    // password prompt + a 2FA challenge. After that the state
    // signature timestamp also rejects.
    res.cookies.set("linkedin_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax", // OAuth callback is cross-site (from linkedin.com), lax is required
      maxAge: 10 * 60,
      path: "/",
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to start OAuth";
    console.error("[leads-gen/connect/linkedin/start]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
