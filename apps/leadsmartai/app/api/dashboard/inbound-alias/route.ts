import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  aliasToAddress,
  ensureAgentAlias,
  getInboundDomain,
} from "@/lib/inbound/aliases";

/**
 * GET /api/dashboard/inbound-alias
 *
 * Returns the current agent's inbound forwarding address, lazy-
 * provisioning one on first call. Used by the "Email forwarding"
 * panel on /dashboard/calendar.
 */
export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const alias = await ensureAgentAlias(String(agentId));
    return NextResponse.json({
      ok: true,
      address: aliasToAddress(alias),
      localPart: alias.local_part,
      domain: getInboundDomain(),
      lastReceivedAt: alias.last_received_at,
      inboundCount: alias.inbound_count,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
