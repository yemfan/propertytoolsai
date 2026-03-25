import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const profile = await getCurrentProfile();

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
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

    const { error } = await supabaseAdmin
      .from("lead_followups")
      .update({ status: "cancelled" })
      .eq("lead_id", leadId)
      .eq("assigned_agent_id", agentId)
      .eq("status", "pending");

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("cancel followups error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to cancel follow-ups" },
      { status: 500 }
    );
  }
}
