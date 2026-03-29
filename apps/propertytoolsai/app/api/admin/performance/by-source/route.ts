import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { getPerformanceBySource } from "@/lib/performance/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: profile ? 403 : 401 });
    }

    const rows = await getPerformanceBySource();
    return NextResponse.json({ success: true, rows });
  } catch (error) {
    console.error("performance by source error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load by-source performance" },
      { status: 500 }
    );
  }
}
