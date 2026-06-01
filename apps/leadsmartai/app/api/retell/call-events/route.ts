import { NextRequest, NextResponse } from "next/server";
import { finalizeCallByProviderId } from "@/lib/missed-call/service";

export const runtime = "nodejs";

/**
 * Retell call-events webhook (LeadSmart) — POST /api/retell/call-events
 *
 * Retell POSTs call lifecycle events (call_started / call_ended / call_analyzed)
 * to the agent's webhook_url. We use the terminal events to finalize the
 * `call_logs` row a placed outbound call wrote at dial time (matched by the
 * Retell call_id, stored in twilio_call_sid): set the real status + duration,
 * and attach the AI call summary once analysis is ready.
 *
 * No-ops for any call_id we didn't log (e.g. inbound Retell calls), so it's safe
 * to point the whole agent here. Always returns 200 so Retell doesn't retry-storm.
 * Retell can't sign this, so gate with ?k=<RETELL_FUNCTION_SECRET>, same as
 * /api/retell/inbound.
 */

type RetellCall = {
  call_id?: string;
  call_status?: string;
  disconnection_reason?: string;
  duration_ms?: number;
  start_timestamp?: number;
  end_timestamp?: number;
  call_analysis?: { call_summary?: string | null } | null;
};

/** Map Retell's disconnection reason → the call_logs status the badge renders. */
function mapStatus(callStatus: string | undefined, reason: string | undefined): string {
  const r = (reason || "").toLowerCase();
  if (r.includes("no_answer")) return "no_answer";
  if (r.includes("busy")) return "busy";
  if (r.includes("voicemail") || r.includes("machine")) return "voicemail";
  if (r.includes("failed") || r.startsWith("error") || callStatus === "error") return "failed";
  // user_hangup, agent_hangup, call_transfer, inactivity, max_duration, etc.
  return "completed";
}

function durationSeconds(call: RetellCall): number | null {
  if (typeof call.start_timestamp === "number" && typeof call.end_timestamp === "number") {
    return (call.end_timestamp - call.start_timestamp) / 1000;
  }
  if (typeof call.duration_ms === "number") return call.duration_ms / 1000;
  return null;
}

export async function POST(req: NextRequest) {
  const secret = process.env.RETELL_FUNCTION_SECRET;
  if (secret && req.nextUrl.searchParams.get("k") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      event?: string;
      call?: RetellCall;
    };
    const call = body.call;

    // Only the terminal events carry an outcome — ignore call_started/registered.
    if (!call?.call_id || (body.event !== "call_ended" && body.event !== "call_analyzed")) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const summary = call.call_analysis?.call_summary?.trim() || "";
    await finalizeCallByProviderId({
      providerCallId: call.call_id,
      status: mapStatus(call.call_status, call.disconnection_reason),
      durationSeconds: durationSeconds(call),
      // Only overwrite the placement note once we have a summary (call_analyzed).
      note: summary ? `AI call summary: ${summary}` : null,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("retell/call-events", e);
    // Always 200 — a webhook error must not make Retell retry-storm.
    return NextResponse.json({ ok: true });
  }
}
