import { NextResponse } from "next/server";
import { runLeadPricingLearningLoop } from "@/lib/leadPricingEngine";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await runLeadPricingLearningLoop();
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
