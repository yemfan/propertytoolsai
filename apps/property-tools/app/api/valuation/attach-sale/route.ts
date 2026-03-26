import { NextResponse } from "next/server";
import { attachActualSaleToValuation } from "@/lib/valuation-tracking/service";
import type { ValuationSaleAttachInput } from "@/lib/valuation-tracking/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ValuationSaleAttachInput>;
    if (!body?.valuationRunId?.trim() || body.actualSalePrice == null || !Number.isFinite(Number(body.actualSalePrice))) {
      return NextResponse.json(
        { success: false, error: "Missing valuationRunId or actualSalePrice" },
        { status: 400 }
      );
    }

    const data = await attachActualSaleToValuation({
      valuationRunId: body.valuationRunId,
      actualSalePrice: Number(body.actualSalePrice),
      actualSaleDate: body.actualSaleDate ?? null,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("valuation attach sale error:", error);
    const msg = error instanceof Error ? error.message : "Failed to attach actual sale";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
