import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { listShowingsForAgent } from "@/lib/showings/service";

export const runtime = "nodejs";

/**
 * GET /api/mobile/showings
 *   ?contactId=…  (optional) filter to one buyer's showings
 *
 * Thin wrapper over the dashboard service so mobile can reuse the
 * exact same query logic. Auth is the same Bearer + agent-row check
 * the rest of /api/mobile/* uses.
 */
export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const url = new URL(req.url);
    const contactId = url.searchParams.get("contactId");
    const showings = await listShowingsForAgent(
      auth.ctx.agentId,
      contactId ? { contactId } : undefined,
    );
    return NextResponse.json({ ok: true, success: true, showings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/mobile/showings", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
