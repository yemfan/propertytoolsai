import { NextResponse } from "next/server";
import { logValuationRun } from "@/lib/valuation-tracking/service";
import type { ValuationTrackingLogInput } from "@/lib/valuation-tracking/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ValuationTrackingLogInput>;
    if (!body?.propertyAddress?.trim() || body.finalEstimate == null || body.lowEstimate == null || body.highEstimate == null) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: propertyAddress, finalEstimate, lowEstimate, highEstimate" },
        { status: 400 }
      );
    }

    const data = await logValuationRun(body as ValuationTrackingLogInput);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("valuation log error:", error);
    return NextResponse.json({ success: false, error: "Failed to log valuation" }, { status: 500 });
  }
}
