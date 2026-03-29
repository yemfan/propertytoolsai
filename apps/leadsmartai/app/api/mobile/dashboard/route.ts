import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { getMobileDashboard } from "@/lib/mobile/mobileDashboard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const payload = await getMobileDashboard(auth.ctx.agentId);
    return NextResponse.json({ ok: true, success: true, ...payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/mobile/dashboard", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
