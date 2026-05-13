import { NextResponse } from "next/server";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import {
  getSubjectsForTrigger,
  isSupportedTrigger,
  SUPPORTED_TRIGGERS,
  type Trigger,
} from "@/lib/leads-gen/subjects";

export const runtime = "nodejs";

/**
 * GET /api/leads-gen/subjects?trigger=<new_listing|open_house|price_drop|just_sold|market_update|testimonial|custom>
 *
 * Returns the picker options for the Quick Post wizard's subject
 * step. Each trigger maps to a different query — see
 * `lib/leads-gen/subjects.ts` for the dispatch table.
 *
 * Plan gate: Pro or higher. Quick Post is included in Pro per the
 * pricing decision; Premium-only features (ad campaigns) land in
 * Phase 2.
 */
export async function GET(req: Request) {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    if (auth.planType === "free") {
      return NextResponse.json(
        { ok: false, error: "Generate Leads requires Pro or higher." },
        { status: 402 },
      );
    }

    const url = new URL(req.url);
    const triggerRaw = (url.searchParams.get("trigger") ?? "").trim();
    if (!isSupportedTrigger(triggerRaw)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Unsupported trigger. Use one of: ${SUPPORTED_TRIGGERS.join(", ")}.`,
        },
        { status: 400 },
      );
    }

    const subjects = await getSubjectsForTrigger(triggerRaw as Trigger, auth.agentId);
    return NextResponse.json({ ok: true, subjects });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load subjects";
    console.error("[leads-gen/subjects]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
