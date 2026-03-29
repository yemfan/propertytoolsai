import { NextResponse } from "next/server";
import { loadValuationBundleFromRentcast } from "@/lib/valuation/adapters/rentcast";
import { runValuationEngineAsync } from "@/lib/valuation/engine";
import { logValuationRun, valuationResultToLogInput } from "@/lib/valuation-tracking";
import type { SubjectPropertyInput } from "@/lib/valuation/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const raw = (await req.json()) as SubjectPropertyInput & { leadId?: string | null };
    const leadId = raw.leadId != null ? String(raw.leadId) : null;
    const subject = { ...raw };
    delete (subject as Record<string, unknown>).leadId;

    if (!subject?.address?.trim()) {
      return NextResponse.json({ success: false, error: "Missing property address" }, { status: 400 });
    }

    const bundle = await loadValuationBundleFromRentcast(subject);
    const result = await runValuationEngineAsync(subject, bundle);

    let valuationRunId: string | null = null;
    try {
      const logged = await logValuationRun(
        valuationResultToLogInput(subject, result, {
          leadId,
          source: "rentcast_valuation_engine",
        })
      );
      valuationRunId = logged?.id != null ? String(logged.id) : null;
    } catch (logErr) {
      console.error("valuation run log (non-fatal):", logErr);
    }

    return NextResponse.json({
      success: true,
      result,
      valuationRunId,
      safeguards: {
        showRangeNotSingleNumber: true,
        lowConfidenceShouldPromptManualReview: result.confidenceLabel === "low",
      },
    });
  } catch (error) {
    console.error("valuation run error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Valuation failed" },
      { status: 500 }
    );
  }
}
