import { NextResponse } from "next/server";
import { generateDealCommentary } from "@/lib/aiDealAnalyzer/generate";
import type {
  DealAnalyzerInputs,
  DealAnalyzerMetrics,
} from "@/lib/aiDealAnalyzer/types";

export const runtime = "nodejs";
// Claude cold generation typically 3-6s. Upper bound generous.
export const maxDuration = 30;

/**
 * POST /api/ai-deal-analyzer/commentary
 *   Body: { inputs, metrics }
 *   Returns: { ok: true, commentary }
 *
 * Unauthenticated — this is a public tool. Cost control is on the
 * calling UI: the page debounces input changes so typing doesn't
 * refire the Claude call on every keystroke.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      inputs?: DealAnalyzerInputs;
      metrics?: DealAnalyzerMetrics;
    };

    if (
      !body.inputs ||
      typeof body.inputs.purchasePrice !== "number" ||
      !body.metrics ||
      typeof body.metrics.capRate !== "number"
    ) {
      return NextResponse.json(
        { ok: false, error: "inputs.purchasePrice and metrics are required" },
        { status: 400 },
      );
    }

    const commentary = await generateDealCommentary(body.inputs, body.metrics);
    return NextResponse.json({ ok: true, commentary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/ai-deal-analyzer/commentary:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
