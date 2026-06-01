import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { loadReceptionistContext } from "@/lib/voice-agent/context";
import { logOutboundCall } from "@/lib/missed-call/service";
import {
  buildOutboundDynamicVariables,
  createPhoneCall,
  normalizePhoneE164,
} from "@repo/voice";

export const runtime = "nodejs";

// The receptionist's own Retell number + agent place the outbound call. Single
// receptionist for now; when multiple agents/numbers exist this resolves from
// the caller's config row instead of these constants.
const FROM_NUMBER = "+18778017240";
const RETELL_AGENT_ID = "agent_7e51ed0664a3716ecaa6a183d4"; // LeadSmart Receptionist (Lucy)

/**
 * Place an outbound AI call. The agent (Lucy) dials the lead from the
 * receptionist number, discloses it's an AI, and follows up per the account's
 * receptionist context. Needs RETELL_API_KEY in the environment.
 */
export async function POST(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json().catch(() => ({}))) as { name?: string; phone?: string };
    const name = String(body.name ?? "").trim();

    const r = normalizePhoneE164(String(body.phone ?? "").trim());
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid phone number (e.g. +1 626 555 1234)." },
        { status: 400 },
      );
    }

    const ctx = await loadReceptionistContext(agentId);
    if (!ctx) {
      return NextResponse.json(
        { ok: false, error: "Your AI receptionist is turned off — enable it in Settings → Voice." },
        { status: 400 },
      );
    }

    const dynamicVariables = buildOutboundDynamicVariables(ctx, {
      leadName: name,
      purpose: "follow_up",
    });

    const { callId } = await createPhoneCall({
      fromNumber: FROM_NUMBER,
      toNumber: r.value,
      agentId: RETELL_AGENT_ID,
      dynamicVariables,
      metadata: { source: "leadsmart-outbound", leadName: name, agentId },
    });

    // Log to call_logs so the call shows in AI Assistant → Inbound & outbound
    // activity immediately. Best-effort — never fail the placed call on a log error.
    await logOutboundCall({
      agentId,
      toPhone: r.value,
      fromPhone: FROM_NUMBER,
      providerCallId: callId,
      leadName: name || null,
    });

    return NextResponse.json({ ok: true, callId, to: r.value });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to place the call.";
    console.error("voice/outbound-call", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
