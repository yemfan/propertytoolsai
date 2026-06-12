import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** POST /api/dashboard/briefings/read { id } — mark a briefing read
 *  (hides the morning card until the next one arrives). */
export async function POST(req: NextRequest) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json().catch(() => ({}))) as { id?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing briefing id." }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from("daily_briefings")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("agent_id", agentId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
