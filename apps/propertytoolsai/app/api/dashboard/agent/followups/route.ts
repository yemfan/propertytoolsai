import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
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

    const agentId = profile.agent_id ?? profile.id;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let query = supabaseAdmin
      .from("lead_followups")
      .select("*")
      .eq("assigned_agent_id", agentId)
      .order("scheduled_for", { ascending: true })
      .limit(100);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      followups: data ?? [],
    });
  } catch (error) {
    console.error("agent followups error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load follow-ups" },
      { status: 500 }
    );
  }
}
