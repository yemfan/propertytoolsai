import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { getPredictedPipelineSummary } from "@/lib/deal-prediction/service";

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: profile ? 403 : 401 }
      );
    }

    const data = await getPredictedPipelineSummary();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("pipeline predictions error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load predicted pipeline" },
      { status: 500 }
    );
  }
}
