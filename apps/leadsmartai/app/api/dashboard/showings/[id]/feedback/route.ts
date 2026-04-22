import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { upsertShowingFeedback, type UpsertFeedbackInput } from "@/lib/showings/service";

export const runtime = "nodejs";

/**
 * PUT /api/dashboard/showings/[id]/feedback
 *
 * Upsert the feedback row for a showing. Single feedback per showing
 * (DB-enforced). Body is the partial fields to write; omitted fields
 * are left untouched by the upsert's conflict resolution.
 */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as UpsertFeedbackInput;
    const feedback = await upsertShowingFeedback(String(agentId), id, body);
    return NextResponse.json({ ok: true, feedback });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("PUT showings/[id]/feedback:", err);
    const status = message === "Showing not found" ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
