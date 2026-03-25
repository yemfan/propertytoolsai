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

    const { notificationId } = await req.json();

    if (!notificationId) {
      return NextResponse.json(
        { success: false, error: "Missing notificationId" },
        { status: 400 }
      );
    }

    const agentId = profile.agent_id ?? profile.id;

    const { error } = await supabaseAdmin
      .from("agent_notifications")
      .update({
        status: "read",
        read_at: new Date().toISOString(),
      })
      .eq("id", notificationId)
      .eq("agent_id", agentId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("mark notification read error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update notification" },
      { status: 500 }
    );
  }
}
