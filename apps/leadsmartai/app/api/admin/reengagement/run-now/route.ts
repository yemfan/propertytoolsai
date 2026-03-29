import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runReengagementJob } from "@/lib/reengagement/service";

export const runtime = "nodejs";

async function agentIdForUser(userId: string) {
  const { data } = await supabaseAdmin.from("agents").select("id").eq("auth_user_id", userId).maybeSingle();
  return data?.id != null ? String(data.id) : null;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserWithRole(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const agentId = await agentIdForUser(user.id);
    if (!agentId) {
      return NextResponse.json(
        { success: false, error: "An agent profile is required to run re-engagement manually" },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { allAgents?: boolean };
    const role = String(user.role ?? "").toLowerCase();
    const runAll = role === "admin" && body.allAgents === true;

    const results = await runReengagementJob(runAll ? undefined : { agentId });
    return NextResponse.json({ success: true, count: results.length, results });
  } catch (e) {
    console.error("reengagement run-now error:", e);
    return NextResponse.json({ success: false, error: "Failed to run reengagement" }, { status: 500 });
  }
}
