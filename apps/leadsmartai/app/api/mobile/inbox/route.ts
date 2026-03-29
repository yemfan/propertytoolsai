import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { getMobileInbox } from "@/lib/mobile/inbox";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const threads = await getMobileInbox(auth.ctx.agentId);
    return NextResponse.json({
      ok: true,
      success: true,
      threads,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/mobile/inbox", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
