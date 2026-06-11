import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** GET /api/dashboard/notifications/unread — unread inbox count for the bell badge. */
export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { count, error } = await supabaseAdmin
      .from("agent_inbox_notifications")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentId)
      .eq("read", false);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, count: count ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ ok: false, error: message, count: 0 }, { status: 500 });
  }
}
