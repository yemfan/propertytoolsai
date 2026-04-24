import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import {
  upsertShowingFeedback,
  type UpsertFeedbackInput,
} from "@/lib/showings/service";

export const runtime = "nodejs";

/**
 * PUT /api/mobile/showings/[id]/feedback
 *   Upserts the post-showing feedback (1:1 with showing). Mobile
 *   sends this from the detail screen as the agent fills it out at
 *   the property — emoji reaction, would-offer flag, free-text
 *   pros/cons.
 */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as UpsertFeedbackInput;
    const feedback = await upsertShowingFeedback(auth.ctx.agentId, id, body);
    return NextResponse.json({ ok: true, success: true, feedback });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const isNotFound = /not found/i.test(msg);
    console.error("PUT /api/mobile/showings/[id]/feedback", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: isNotFound ? 404 : 500 },
    );
  }
}
