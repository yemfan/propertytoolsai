import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";

import {
  generateAuthorizeUrl,
  signState,
} from "@/lib/leads-gen/linkedin-oauth";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const bodySchema = z.object({
  /** Deep link the OAuth callback should redirect to. Must use the
   *  `leadsmart://` scheme so /callback's strict validation accepts it. */
  returnTo: z.string().regex(/^leadsmart:\/\//i),
});

/**
 * POST /api/mobile/leads-gen/connect/linkedin/init
 *
 * Mobile-side counterpart to GET /api/leads-gen/connect/linkedin/start.
 * Same shape as the Meta init endpoint — Bearer-auth in, signed
 * Meta OAuth URL with `returnTo` baked into the state token out.
 * See app/api/mobile/leads-gen/connect/meta/init/route.ts for the
 * full rationale on why this exists separately from the web /start
 * route (mobile in-app browser can't carry the cookie).
 *
 * Plan gate: Pro+ (same as Meta).
 */
export async function POST(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
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
          error: "Connecting LinkedIn requires Pro or higher.",
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
    console.error("[mobile/leads-gen/connect/linkedin/init]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
