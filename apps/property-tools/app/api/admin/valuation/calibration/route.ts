import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { getCalibrationProfiles, runAutoCalibration } from "@/lib/valuation-calibration/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: profile ? 403 : 401 });
    }

    const profiles = await getCalibrationProfiles();
    return NextResponse.json({ success: true, profiles });
  } catch (error) {
    console.error("valuation calibration get error:", error);
    return NextResponse.json({ success: false, error: "Failed to load calibration" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: profile ? 403 : 401 });
    }

    const result = await runAutoCalibration();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("valuation calibration run error:", error);
    return NextResponse.json({ success: false, error: "Failed to run calibration" }, { status: 500 });
  }
}
