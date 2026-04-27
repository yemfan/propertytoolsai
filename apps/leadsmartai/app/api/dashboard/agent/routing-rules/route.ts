import { NextResponse } from "next/server";

import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  getAgentRoutingRule,
  upsertAgentRoutingRule,
} from "@/lib/leadAssignment/rulesDbService";
import { sanitizeZipCoverage } from "@/lib/leadAssignment/routingRules";

export const runtime = "nodejs";

/**
 * Per-agent IDX lead-routing rule. One row per agent in
 * `agent_lead_routing` (PK on agent_id), upsert-shaped.
 *
 * GET   — read this agent's rule (returns a default shape if no row yet)
 * PATCH — upsert with the submitted toggle + ZIP list
 *
 * Auth: getCurrentAgentContext throws if the user isn't authed or has no
 * agent row, so we don't need to handle those explicitly. RLS on
 * `agent_lead_routing` enforces ownership at the DB layer too.
 */
export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const rule = await getAgentRoutingRule(agentId);
    return NextResponse.json({ ok: true, rule });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json().catch(() => ({}))) as {
      inRoundRobin?: unknown;
      zipCoverage?: unknown;
    };

    if (typeof body.inRoundRobin !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "inRoundRobin (boolean) is required." },
        { status: 400 },
      );
    }

    // ZIP list is sanitized server-side regardless of what the client sent.
    // The UI also sanitizes (so it can show a cleaned preview), but we don't
    // trust the client's filtering.
    const zipInput =
      typeof body.zipCoverage === "string" || Array.isArray(body.zipCoverage)
        ? (body.zipCoverage as string | string[])
        : [];
    const zipCoverage = sanitizeZipCoverage(zipInput);

    const rule = await upsertAgentRoutingRule({
      agentId,
      inRoundRobin: body.inRoundRobin,
      zipCoverage,
    });
    return NextResponse.json({ ok: true, rule });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
