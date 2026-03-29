import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { runValuationTrainWorkflow } from "@/lib/valuation-training/workflow";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: profile ? 403 : 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const filters = (body.filters as Record<string, unknown> | undefined) ?? {};
    const minRows =
      typeof body.minRows === "number" && Number.isFinite(body.minRows)
        ? Math.max(1, Math.floor(body.minRows))
        : 30;

    const result = await runValuationTrainWorkflow({
      exportName: typeof body.exportName === "string" ? body.exportName : undefined,
      filters,
      activateAfterTraining: Boolean(body.activateAfterTraining),
      trainedBy: profile.id,
      notes: typeof body.notes === "string" ? body.notes : null,
      minRows,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("valuation train workflow error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Workflow failed" },
      { status: 500 }
    );
  }
}
