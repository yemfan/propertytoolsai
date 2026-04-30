import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import {
  getShowingWithFeedback,
  updateShowing,
  type UpdateShowingInput,
} from "@/lib/showings/service";

export const runtime = "nodejs";

/**
 * GET /api/mobile/showings/[id]
 *   Returns { showing, feedback, contactName, siblingShowings }
 *
 * PATCH /api/mobile/showings/[id]
 *   Body subset of UpdateShowingInput. Used by mobile to flip
 *   status (scheduled → attended), edit notes, etc. Same shape as
 *   the dashboard PATCH but auth is mobile-Bearer.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await ctx.params;
    const result = await getShowingWithFeedback(auth.ctx.agentId, id);
    if (!result) {
      return NextResponse.json(
        { ok: false, success: false, error: "Not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, success: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/mobile/showings/[id]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Partial<UpdateShowingInput>;
    const updated = await updateShowing(auth.ctx.agentId, id, body);
    if (!updated) {
      return NextResponse.json(
        { ok: false, success: false, error: "Not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, success: true, showing: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("PATCH /api/mobile/showings/[id]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
