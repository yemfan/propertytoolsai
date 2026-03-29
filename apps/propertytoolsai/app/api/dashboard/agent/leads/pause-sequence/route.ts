import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { pausePendingSequenceForLead } from "@/lib/home-value/pause-sequence";

export async function POST(req: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (profile.role !== "agent" && profile.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const { leadId } = await req.json();
    if (!leadId) {
      return NextResponse.json(
        { success: false, error: "Missing leadId" },
        { status: 400 }
      );
    }

    const agentId = profile.agent_id ?? profile.id;
    if (profile.role !== "admin") {
      const { data: lead, error } = await supabaseAdmin
        .from("leads")
        .select("id")
        .eq("id", leadId)
        .eq("assigned_agent_id", agentId)
        .maybeSingle();

      if (error || !lead) {
        return NextResponse.json(
          { success: false, error: "Lead not found" },
          { status: 404 }
        );
      }
    }

    await pausePendingSequenceForLead(leadId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("pause sequence error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to pause sequence" },
      { status: 500 }
    );
  }
}
