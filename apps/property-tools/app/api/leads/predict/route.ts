import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateLeadPrediction } from "@/lib/deal-prediction/service";

export async function POST(req: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || (profile.role !== "agent" && profile.role !== "admin")) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: profile ? 403 : 401 }
      );
    }

    const body = (await req.json()) as { leadId?: string };
    const leadId = body.leadId;
    if (!leadId) {
      return NextResponse.json({ success: false, error: "Missing leadId" }, { status: 400 });
    }

    if (profile.role !== "admin") {
      const agentId = profile.agent_id ?? profile.id;
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("assigned_agent_id")
        .eq("id", leadId)
        .maybeSingle();

      if (!lead || String(lead.assigned_agent_id ?? "") !== String(agentId)) {
        return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
      }
    }

    const prediction = await updateLeadPrediction(leadId);
    return NextResponse.json({ success: true, prediction });
  } catch (error) {
    console.error("lead prediction error:", error);
    return NextResponse.json({ success: false, error: "Failed to predict lead" }, { status: 500 });
  }
}
