import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";

import { generateAuthorizeUrl, signState } from "@/lib/leads-gen/meta-oauth";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const bodySchema = z.object({
  /** Deep link the OAuth callback should redirect to. Must use the
   *  `leadsmart://` scheme so /callback's strict validation accepts it. */
  returnTo: z.string().regex(/^leadsmart:\/\//i),
});

/**
 * POST /api/mobile/leads-gen/connect/meta/init
 *
 * Mobile-side counterpart to the web's GET /api/leads-gen/connect/meta/start.
 *
 * Web flow uses a redirect chain anchored on a cookie-bound state
 * token — mobile in-app browsers can't carry that cookie because
 * the navigation originates from the app rather than a logged-in
 * web session. So mobile instead:
 *
 *   1. Calls this endpoint with Bearer auth (Supabase JWT)
 *   2. We mint a signed state token that includes the agent's id
 *      AND the mobile `returnTo` deep link
 *   3. We return the Meta OAuth URL pre-baked with that state
 *   4. Mobile opens the URL via `WebBrowser.openAuthSessionAsync`
 *      with the same `returnTo` as the resolve URL
 *   5. After Meta + our /callback complete, /callback redirects to
 *      the deep link, which `WebBrowser.openAuthSessionAsync` picks
 *      up and resolves with
 *
 * The state token is the single source of truth for what's allowed
 * — /callback verifies the HMAC + scheme + agentId before doing
 * anything. No cookie needed since the token is bound to the
 * specific agentId and expires in 10 minutes.
 *
 * Plan gate: Pro+ (Quick Post tier; mirrors web).
 */
export async function POST(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    // Plan check — same Pro+ rule as /api/leads-gen/connect/meta/start.
    const { data: agentRow } = await supabaseAdmin
      .from("agents")
      .select("plan_type")
      .eq("id", auth.ctx.agentId)
      .maybeSingle();
    const planType = (
      (agentRow as { plan_type: string | null } | null)?.plan_type ?? "free"
    ).toLowerCase();
    if (planType === "free") {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: "Connecting Facebook requires Pro or higher.",
        },
        { status: 402 },
      );
    }

    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: "Invalid body",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const state = signState({
      nonce: crypto.randomBytes(16).toString("hex"),
      agentId: auth.ctx.agentId,
      issuedAt: Date.now(),
      returnTo: parsed.data.returnTo,
    });

    const url = generateAuthorizeUrl(state);
    return NextResponse.json({ ok: true, success: true, url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to start OAuth";
    console.error("[mobile/leads-gen/connect/meta/init]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
