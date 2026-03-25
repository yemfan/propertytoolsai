import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { getPerformanceOverview } from "@/lib/performance/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: profile ? 403 : 401 });
    }

    const data = await getPerformanceOverview();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("performance overview error:", error);
    return NextResponse.json({ success: false, error: "Failed to load overview" }, { status: 500 });
  }
}
