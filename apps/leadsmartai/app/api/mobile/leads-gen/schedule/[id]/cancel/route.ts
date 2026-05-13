import { NextResponse } from "next/server";

import { requireMobileAgent } from "@/lib/mobile/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * POST /api/mobile/leads-gen/schedule/[id]/cancel
 *
 * Mobile-side counterpart to /api/leads-gen/schedule/[id]/cancel.
 * Marks a scheduled post 'cancelled' so the cron skips it. Only
 * pre-publish states (scheduled / posting) can be cancelled.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json(
        { ok: false, success: false, error: "Missing scheduled post id" },
        { status: 400 },
      );
    }

    const { data: updated, error } = await supabaseAdmin
      .from("scheduled_posts")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq("id", id)
      .eq("agent_id", auth.ctx.agentId)
      .in("status", ["scheduled", "posting"])
      .select("id, status");
    if (error) throw error;

    const list = (updated as Array<{ id: string; status: string }> | null) ?? [];
    if (list.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error:
            "Couldn't cancel — the post is already published, failed, or doesn't exist.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      success: true,
      id: list[0]!.id,
      status: list[0]!.status,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Cancel failed";
    console.error("[mobile/leads-gen/schedule/cancel]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
