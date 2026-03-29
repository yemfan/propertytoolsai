import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateLeadScore } from "@/lib/lead-scoring/service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || (profile.role !== "agent" && profile.role !== "admin")) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: profile ? 403 : 401 }
      );
    }

    const { leadId } = await req.json();
    if (!leadId) {
      return NextResponse.json({ success: false, error: "Missing leadId" }, { status: 400 });
    }

    const agentId = profile.agent_id ?? profile.id;
    let leadQuery = supabaseAdmin.from("leads").select("id").eq("id", leadId);
    if (profile.role !== "admin") {
      leadQuery = leadQuery.eq("assigned_agent_id", agentId);
    }

    const { data: exists, error: leadErr } = await leadQuery.maybeSingle();
    if (leadErr || !exists) {
      return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
    }

    const result = await updateLeadScore(String(leadId));
    return NextResponse.json({
      success: true,
      score: result.score,
      temperature: result.temperature,
      last_activity_at: result.last_activity_at,
    });
  } catch (error) {
    console.error("lead score refresh error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update lead score" },
      { status: 500 }
    );
  }
}
