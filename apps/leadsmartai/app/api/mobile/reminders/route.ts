import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { getMobileReminders } from "@/lib/mobile/remindersMobile";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const data = await getMobileReminders(auth.ctx.agentId);
    return NextResponse.json({ ok: true, success: true, ...data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/mobile/reminders", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
