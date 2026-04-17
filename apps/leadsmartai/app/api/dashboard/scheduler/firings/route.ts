import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  listFiringsForAgent,
  type FiringOutcomeFilter,
  type FiringRange,
} from "@/lib/scheduler/firings";

export const runtime = "nodejs";

const OUTCOMES: readonly FiringOutcomeFilter[] = [
  "all",
  "created",
  "suppressed",
  "suppressed_opt_in",
  "suppressed_agent_of_record",
  "suppressed_template_off",
  "suppressed_per_contact_trigger_off",
  "suppressed_other",
];
const RANGES: readonly FiringRange[] = ["24h", "7d", "30d", "all"];

function parseOutcome(v: string | null): FiringOutcomeFilter {
  return v && (OUTCOMES as readonly string[]).includes(v)
    ? (v as FiringOutcomeFilter)
    : "all";
}
function parseRange(v: string | null): FiringRange {
  return v && (RANGES as readonly string[]).includes(v) ? (v as FiringRange) : "30d";
}

export async function GET(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const url = new URL(req.url);
    const page = await listFiringsForAgent(agentId, {
      outcome: parseOutcome(url.searchParams.get("outcome")),
      range: parseRange(url.searchParams.get("range")),
      limit: Number(url.searchParams.get("limit") ?? 50) || 50,
      before: url.searchParams.get("before") ?? undefined,
    });
    return NextResponse.json({ ok: true, ...page });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("dashboard/scheduler/firings GET", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
