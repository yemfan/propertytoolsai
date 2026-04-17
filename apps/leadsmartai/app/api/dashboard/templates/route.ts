import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { listTemplatesForAgent } from "@/lib/templates/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const templates = await listTemplatesForAgent(agentId);
    return NextResponse.json({ ok: true, templates });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("templates GET", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
