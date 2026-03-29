import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { getMobileDailyAgenda } from "@/lib/mobile/dailyAgendaMobile";

export const runtime = "nodejs";

/** Canonical mobile path; mirrors `GET /api/mobile/agenda`. */
export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const date = new URL(req.url).searchParams.get("date")?.trim() || undefined;
    const payload = await getMobileDailyAgenda(auth.ctx.agentId, date);
    return NextResponse.json({ ok: true, success: true, ...payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/mobile/daily-agenda", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
