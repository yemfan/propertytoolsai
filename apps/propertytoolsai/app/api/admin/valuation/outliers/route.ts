import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { getValuationOutliers } from "@/lib/valuation-tracking/service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: profile ? 403 : 401 });
    }

    const limit = Math.min(100, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 25));
    const rows = await getValuationOutliers(limit);
    return NextResponse.json({ success: true, rows });
  } catch (error) {
    console.error("valuation outliers api error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load valuation outliers" },
      { status: 500 }
    );
  }
}
