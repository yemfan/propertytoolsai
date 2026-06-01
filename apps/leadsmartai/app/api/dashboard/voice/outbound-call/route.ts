import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { loadReceptionistContext } from "@/lib/voice-agent/context";
import { placeOutboundCall } from "@/lib/voice-agent/outbound";
import { normalizePhoneE164 } from "@repo/voice";

export const runtime = "nodejs";

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

    const { callId } = await placeOutboundCall({
      ctx,
      agentId,
      leadName: name,
      toNumberE164: r.value,
    });

    return NextResponse.json({ ok: true, callId, to: r.value });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to place the call.";
    console.error("voice/outbound-call", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
