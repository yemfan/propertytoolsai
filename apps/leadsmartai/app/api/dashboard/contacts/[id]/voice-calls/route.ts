import { NextResponse } from "next/server";

import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { groupByCall, type VoiceCallEventRow } from "@/lib/voiceCallTimeline/format";

export const runtime = "nodejs";

/**
 * GET — voice-call timeline for one contact, scoped to the authenticated
 * agent. Reads `contact_events` rows where event_type is voice-call related
 * and groups them by `metadata.twilio_call_sid` into one entry per call.
 *
 * The status-callback handler (#154) writes one event per Twilio state
 * transition (initiated → ringing → in-progress → completed). The
 * formatter collapses those into the agent-facing summary the timeline
 * panel renders.
 *
 * Cross-agent ids return 404 (existence not leaked) — matches the IDX
 * detail-route + equity-message-send pattern from earlier work.
 */

const VOICE_EVENT_TYPES = ["voice_demo_call_status"] as const;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ ok: false, error: "missing_contact_id" }, { status: 400 });
    }

    const supabase = supabaseServerClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!userData.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    // Resolve agent id, then verify the contact belongs to this agent.
    const { data: agentRow } = await supabase
      .from("agents")
      .select("id")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();

    const agentId = agentRow?.id != null ? String(agentRow.id) : null;
    if (agentId == null) {
      return NextResponse.json(
        { ok: false, error: "Complete agent signup before using the CRM.", code: "NO_AGENT_ROW" },
        { status: 403 },
      );
    }

    // Ownership check — return 404 (not 403) for cross-agent ids so
    // existence isn't leaked.
    const { data: contactRow } = await supabase
      .from("contacts")
      .select("id")
      .eq("agent_id", agentId)
      .eq("id", id)
      .maybeSingle();
    if (!contactRow) {
      return NextResponse.json({ ok: false, error: "contact_not_found" }, { status: 404 });
    }

    // Voice-call event rows belong to this contact AND match a known
    // voice-call event type. The metadata column is the source of truth
    // for call_sid / status / duration.
    const { data: rawEvents } = await supabase
      .from("contact_events")
      .select("created_at, metadata")
      .eq("contact_id", id)
      .in("event_type", VOICE_EVENT_TYPES as unknown as string[])
      .order("created_at", { ascending: true })
      .limit(500);

    const rows: VoiceCallEventRow[] = ((rawEvents ?? []) as Array<{
      created_at: string;
      metadata: Record<string, unknown> | null;
    }>).map((e) => ({
      createdAt: String(e.created_at),
      metadata: e.metadata
        ? {
            twilio_call_sid:
              typeof e.metadata.twilio_call_sid === "string"
                ? e.metadata.twilio_call_sid
                : undefined,
            status: typeof e.metadata.status === "string" ? e.metadata.status : undefined,
            duration_seconds:
              typeof e.metadata.duration_seconds === "number"
                ? e.metadata.duration_seconds
                : null,
            error_code:
              typeof e.metadata.error_code === "string" ? e.metadata.error_code : null,
            has_recording: e.metadata.has_recording === true,
          }
        : null,
    }));

    const calls = groupByCall(rows);
    return NextResponse.json({ ok: true, calls });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
