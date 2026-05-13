import { NextResponse } from "next/server";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * POST /api/leads-gen/schedule/[id]/cancel
 *
 * Marks a scheduled post as `cancelled` so the cron skips it. Only
 * pre-publish states can be cancelled — once status='posted' or
 * 'failed', it's terminal.
 *
 * Why we don't delete the row: keeps the agent's "Scheduled" tab
 * showing recent cancellations for audit context (e.g. "I cancelled
 * the wrong post"). The Recent tab can filter cancelled-7-days-ago
 * out later.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    if (auth.planType === "free") {
      return NextResponse.json(
        { ok: false, error: "Scheduling requires Pro or higher." },
        { status: 402 },
      );
    }

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing scheduled post id" },
        { status: 400 },
      );
    }

    // Conditional update so we only cancel pre-publish states. If a
    // cron run flipped the row to 'posted' between the agent clicking
    // Cancel and us getting here, this is a no-op and we return a
    // clear 422 — the post is already live.
    const { data: updated, error } = await supabaseAdmin
      .from("scheduled_posts")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq("id", id)
      .eq("agent_id", auth.agentId)
      .in("status", ["scheduled", "posting"])
      .select("id, status");

    if (error) throw error;

    const list = (updated as Array<{ id: string; status: string }> | null) ?? [];
    if (list.length === 0) {
      // Either the id wasn't ours, or it was already in a terminal state.
      return NextResponse.json(
        {
          ok: false,
          error: "Couldn't cancel — the post is already published, failed, or doesn't exist.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ ok: true, id: list[0]!.id, status: list[0]!.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Cancel failed";
    console.error("[leads-gen/schedule/cancel]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
