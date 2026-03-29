import { NextResponse } from "next/server";
import { getAgentDashboardOverview } from "@/lib/dashboard/agent";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";

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

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start") || undefined;
    const end = searchParams.get("end") || undefined;

    const agentId = profile.agent_id ?? profile.id;

    const data = await getAgentDashboardOverview({
      agentId,
      start,
      end,
    });

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error("Agent dashboard error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load agent dashboard" },
      { status: 500 }
    );
  }
}
