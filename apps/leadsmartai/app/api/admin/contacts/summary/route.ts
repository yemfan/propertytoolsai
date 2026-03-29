import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getContactHealthSummary } from "@/lib/contact-enrichment/service";

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

    const isAdmin = String(user.role ?? "").toLowerCase() === "admin";
    const agentFilter = isAdmin ? null : await agentIdForUser(user.id);

    if (!isAdmin && !agentFilter) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const summary = await getContactHealthSummary(agentFilter);
    return NextResponse.json({ success: true, summary });
  } catch (e) {
    console.error("contact summary error:", e);
    return NextResponse.json({ success: false, error: "Failed to load contact health summary" }, { status: 500 });
  }
}
