import { NextResponse } from "next/server";
import { runAutoCalibration } from "@/lib/valuation-calibration/service";
import { verifyCronRequest } from "@/lib/seoOptimization/cronAuth";

export const runtime = "nodejs";

/** Vercel Cron calls GET — delegate to the shared calibration logic. */
export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runAutoCalibration();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("valuation calibration cron error:", error);
    return NextResponse.json({ success: false, error: "Failed valuation calibration job" }, { status: 500 });
  }
}

/** Keep POST for manual / internal triggers. */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const expected = `Bearer ${process.env.CRON_SECRET}`;
    if (!process.env.CRON_SECRET || authHeader !== expected) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const result = await runAutoCalibration();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("valuation calibration cron error:", error);
    return NextResponse.json({ success: false, error: "Failed valuation calibration job" }, { status: 500 });
  }
}
