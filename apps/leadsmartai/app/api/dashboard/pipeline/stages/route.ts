import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { listPipelineStages } from "@/lib/crm/pipeline/stages";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const stages = await listPipelineStages(agentId);
    return NextResponse.json({ ok: true, stages });
  } catch (e: any) {
    console.error("pipeline stages", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
