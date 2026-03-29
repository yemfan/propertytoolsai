import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function agentIdForUser(userId: string) {
  const { data } = await supabaseAdmin.from("agents").select("id").eq("auth_user_id", userId).maybeSingle();
  return data?.id != null ? String(data.id) : null;
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUserWithRole(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const role = String(user.role ?? "").toLowerCase();
    const isAdmin = role === "admin";
    const agentId = await agentIdForUser(user.id);

    if (!isAdmin && !agentId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    let countQ = supabaseAdmin.from("reengagement_campaigns").select("id", { count: "exact", head: true });
    if (!isAdmin) countQ = countQ.eq("agent_id", agentId as any);
    const { count, error: countErr } = await countQ;
    if (countErr) throw countErr;

    let listQ = supabaseAdmin.from("reengagement_campaigns").select("id,name,status").order("created_at", { ascending: false }).limit(20);
    if (!isAdmin) listQ = listQ.eq("agent_id", agentId as any);
    const { data, error } = await listQ;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      campaignCount: count ?? 0,
      campaigns: data ?? [],
    });
  } catch (e) {
    console.error("reengagement status error:", e);
    return NextResponse.json({ success: false, error: "Failed to load status" }, { status: 500 });
  }
}
