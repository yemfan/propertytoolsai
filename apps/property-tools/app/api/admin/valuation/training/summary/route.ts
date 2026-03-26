import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import {
  getTrainingDatasetSummary,
  parseTrainingFiltersFromSearchParams,
} from "@/lib/valuation-training/service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: profile ? 403 : 401 });
    }

    const { searchParams } = new URL(req.url);
    const filters = parseTrainingFiltersFromSearchParams(searchParams);

    const summary = await getTrainingDatasetSummary(filters);
    return NextResponse.json({ success: true, summary, filters });
  } catch (error) {
    console.error("valuation training summary error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load training summary" },
      { status: 500 }
    );
  }
}
