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

    if (profile.role !== "agent" && profile.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const { followupId, subject, message } = await req.json();
    if (!followupId || !message) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const agentId = profile.agent_id ?? profile.id;
    let query = supabaseAdmin
      .from("lead_followups")
      .select("id")
      .eq("id", followupId)
      .eq("status", "pending");

    if (profile.role !== "admin") {
      query = query.eq("assigned_agent_id", agentId);
    }

    const { data: followup, error: followupError } = await query.single();
    if (followupError || !followup) {
      return NextResponse.json(
        { success: false, error: "Follow-up not found" },
        { status: 404 }
      );
    }

    const { error } = await supabaseAdmin
      .from("lead_followups")
      .update({
        subject: subject ?? null,
        message,
      })
      .eq("id", followupId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("edit followup error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to edit follow-up" },
      { status: 500 }
    );
  }
}
