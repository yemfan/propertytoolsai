import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { generateAuthorizeUrl, signState } from "@/lib/leads-gen/meta-oauth";

export const runtime = "nodejs";

/**
 * GET /api/leads-gen/connect/meta/start
 *
 * Initiates the Meta OAuth flow. Generates a signed state token,
 * stuffs it into a short-lived HttpOnly cookie (defense in depth
 * on top of the signature), and redirects the agent to the
 * Facebook OAuth dialog.
 *
 * The callback (/api/leads-gen/connect/meta/callback) verifies the
 * state against both the cookie AND the HMAC signature.
 *
 * Plan gate: Pro or higher (Phase 2A is included with Quick Post).
 * The actual Lead-Ads feature lands later and is Premium-only, but
 * the OAuth connection itself is a prerequisite for both.
 */
export async function GET() {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    if (auth.planType === "free") {
      return NextResponse.json(
        { ok: false, error: "Connecting Facebook requires Pro or higher." },
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
    res.cookies.set("meta_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax", // OAuth callback is cross-site (from facebook.com), lax is required
      maxAge: 10 * 60,
      path: "/",
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to start OAuth";
    console.error("[leads-gen/connect/meta/start]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
