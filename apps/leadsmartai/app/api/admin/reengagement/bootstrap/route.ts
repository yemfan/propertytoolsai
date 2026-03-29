import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { bootstrapDefaultCampaign } from "@/lib/reengagement/service";

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
      return NextResponse.json({ success: false, error: "No agent profile" }, { status: 403 });
    }

    const result = await bootstrapDefaultCampaign(agentId);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("reengagement bootstrap error:", e);
    return NextResponse.json({ success: false, error: "Failed to bootstrap campaign" }, { status: 500 });
  }
}
