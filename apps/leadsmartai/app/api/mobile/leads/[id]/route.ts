import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { getMobileLeadDetail } from "@/lib/mobile/leads";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await ctx.params;
    const leadId = String(id ?? "").trim();
    if (!leadId) {
      return NextResponse.json(
        { ok: false, success: false, error: "Missing lead id" },
        { status: 400 }
      );
    }

    const detail = await getMobileLeadDetail(auth.ctx.agentId, leadId);
    if (!detail) {
      return NextResponse.json({ ok: false, success: false, error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      success: true,
      ...detail,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/mobile/leads/[id]", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
