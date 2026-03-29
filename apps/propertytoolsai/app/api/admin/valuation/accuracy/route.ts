import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { getValuationAccuracySummary, getValuationCalibrationHints } from "@/lib/valuation-tracking/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: profile ? 403 : 401 });
    }

    const [summary, hints] = await Promise.all([
      getValuationAccuracySummary(),
      getValuationCalibrationHints(),
    ]);

    return NextResponse.json({ success: true, summary, hints });
  } catch (error) {
    console.error("valuation accuracy api error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load valuation accuracy" },
      { status: 500 }
    );
  }
}
