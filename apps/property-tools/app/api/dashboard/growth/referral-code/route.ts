import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { createReferralCodeForAgent, listReferralCodesForAgent } from "@/lib/growth/referralDb";

export const runtime = "nodejs";

export async function GET() {
  try {
    const ctx = await getCurrentAgentContext();
    const codes = await listReferralCodesForAgent(ctx.agentId);
    return NextResponse.json({ ok: true, codes });
  } catch (e: any) {
    if (e?.message === "Not authenticated") {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getCurrentAgentContext();
    const body = (await req.json().catch(() => ({}))) as { label?: string };
    const { code } = await createReferralCodeForAgent({
      authUserId: ctx.userId,
      agentId: ctx.agentId,
      label: body.label,
    });
    return NextResponse.json({ ok: true, code });
  } catch (e: any) {
    if (e?.message === "Not authenticated") {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
