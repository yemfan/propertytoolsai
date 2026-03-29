import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  context: { params: Promise<{ leadId: string }> }
) {
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

    const { leadId } = await context.params;
    const agentId = profile.agent_id ?? profile.id;

    let leadQuery = supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", leadId);

    if (profile.role !== "admin") {
      leadQuery = leadQuery.eq("assigned_agent_id", agentId);
    }

    const { data: lead, error: leadError } = await leadQuery.single();
    if (leadError || !lead) {
      return NextResponse.json(
        { success: false, error: "Lead not found" },
        { status: 404 }
      );
    }

    const [{ data: report }, { data: followups }, { data: notifications }, { data: conversations }] =
      await Promise.all([
        supabaseAdmin
          .from("home_value_reports")
          .select("*")
          .eq("lead_id", leadId)
          .maybeSingle(),
        supabaseAdmin
          .from("lead_followups")
          .select("*")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: true }),
        supabaseAdmin
          .from("agent_notifications")
          .select("*")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("lead_conversations")
          .select("*")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: true }),
      ]);

    return NextResponse.json({
      success: true,
      lead,
      report: report ?? null,
      followups: followups ?? [],
      notifications: notifications ?? [],
      conversations: conversations ?? [],
    });
  } catch (error) {
    console.error("lead detail error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load lead detail" },
      { status: 500 }
    );
  }
}
