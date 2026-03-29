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

    const { followupId } = await req.json();

    if (!followupId) {
      return NextResponse.json(
        { success: false, error: "Missing followupId" },
        { status: 400 }
      );
    }

    const agentId = profile.agent_id ?? profile.id;

    const { error } = await supabaseAdmin
      .from("lead_followups")
      .update({
        status: "pending",
        scheduled_for: new Date().toISOString(),
      })
      .eq("id", followupId)
      .eq("assigned_agent_id", agentId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("resend followup error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to resend follow-up" },
      { status: 500 }
    );
  }
}
