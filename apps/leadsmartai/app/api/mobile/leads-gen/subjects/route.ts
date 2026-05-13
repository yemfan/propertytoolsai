import { NextResponse } from "next/server";

import {
  getSubjectsForTrigger,
  isSupportedTrigger,
  SUPPORTED_TRIGGERS,
  type Trigger,
} from "@/lib/leads-gen/subjects";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/mobile/leads-gen/subjects?trigger=<...>
 *
 * Mobile-side counterpart to /api/leads-gen/subjects. Returns the
 * picker options for the trigger the agent selected — e.g.
 * "new_listing" → up to 8 listings from the last 60 days. Same
 * `Subject` shape as the web wizard.
 *
 * The mobile Quick Post screen uses this to auto-fill the brief
 * with concrete listing details (address, price, neighborhood)
 * instead of forcing the agent to retype them on a phone keyboard.
 *
 * Plan gate: Pro+.
 */
export async function GET(req: Request) {
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
          error: "Generate Leads requires Pro or higher.",
        },
        { status: 402 },
      );
    }

    const url = new URL(req.url);
    const triggerRaw = (url.searchParams.get("trigger") ?? "").trim();
    if (!isSupportedTrigger(triggerRaw)) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: `Unsupported trigger. Use one of: ${SUPPORTED_TRIGGERS.join(", ")}.`,
        },
        { status: 400 },
      );
    }

    const subjects = await getSubjectsForTrigger(
      triggerRaw as Trigger,
      auth.ctx.agentId,
    );
    return NextResponse.json({ ok: true, success: true, subjects });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load subjects";
    console.error("[mobile/leads-gen/subjects]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
