import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isBehaviorEventType } from "@/lib/contacts/behavior/scoring";

export const runtime = "nodejs";

/**
 * Behavioral event ingestion.
 *
 * Accepts POST `{ contactId, eventType, payload?, sessionId?, agentId? }`.
 * Writes a row into contact_events. Used by client-side trackers on
 * property detail pages, search results, home-value tools, and any other
 * page the consumer interacts with.
 *
 * Safety:
 *   - Anyone (authenticated or not) can POST, but without a valid contactId
 *     or a sessionId that maps to a known contact, the event is dropped.
 *     This keeps attackers from flooding the score engine for random uuids.
 *   - eventType is validated against BEHAVIOR_EVENT_TYPES.
 *   - payload is capped at 4KB post-stringify so a rogue page can't stuff
 *     multi-MB JSON into the warehouse.
 */

const MAX_PAYLOAD_BYTES = 4096;

type PostBody = {
  contactId?: unknown;
  eventType?: unknown;
  payload?: unknown;
  sessionId?: unknown;
  agentId?: unknown;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as PostBody;
    const eventType =
      typeof body.eventType === "string" ? body.eventType.trim() : "";
    if (!isBehaviorEventType(eventType)) {
      return NextResponse.json(
        { ok: false, error: "Invalid eventType" },
        { status: 400 },
      );
    }

    // Resolve contact_id. Either the caller passed a known contactId, or
    // they passed a sessionId that we can look up (e.g., anonymous browser
    // activity before unlock-report flow populated a contact row).
    let contactId: string | null =
      typeof body.contactId === "string" && body.contactId.trim()
        ? body.contactId.trim()
        : null;

    if (!contactId && typeof body.sessionId === "string" && body.sessionId.trim()) {
      // Look up most-recent contact tied to this session_id. The
      // home-value flow stores session_id on the contact row at unlock
      // time, so once unlocked, pre-unlock events can be attributed.
      const { data } = await supabaseAdmin
        .from("contacts")
        .select("id")
        .eq("source_session_id", body.sessionId.trim())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) contactId = String((data as { id: string }).id);
    }

    if (!contactId) {
      // Accept-and-drop rather than 400 so client-side trackers don't
      // surface errors for anonymous pre-unlock activity. Anonymous
      // events can't be scored anyway — they belong to no one yet.
      return NextResponse.json(
        { ok: true, accepted: false, reason: "no contact" },
        { status: 200 },
      );
    }

    // Agent_id: optional. If not provided, look it up from the contact
    // (contact.agent_id). Agent-scoped rollups need it, so fill best we
    // can.
    let agentId: string | number | null =
      typeof body.agentId === "string" || typeof body.agentId === "number"
        ? body.agentId
        : null;
    if (!agentId) {
      const { data } = await supabaseAdmin
        .from("contacts")
        .select("agent_id")
        .eq("id", contactId)
        .maybeSingle();
      const aid = (data as { agent_id: unknown } | null)?.agent_id;
      if (aid != null) agentId = aid as string | number;
    }

    // Payload size cap.
    let payloadObj: Record<string, unknown> = {};
    if (body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)) {
      const serialized = JSON.stringify(body.payload);
      if (serialized.length > MAX_PAYLOAD_BYTES) {
        return NextResponse.json(
          { ok: false, error: "Payload too large" },
          { status: 413 },
        );
      }
      payloadObj = body.payload as Record<string, unknown>;
    }

    const { error } = await supabaseAdmin.from("contact_events").insert({
      contact_id: contactId,
      agent_id: agentId as never,
      event_type: eventType,
      payload: payloadObj as never,
      source: "web",
    } as never);

    if (error) {
      // Don't leak DB errors to the browser — log server-side, return 500.
      console.error("[events/track] insert failed", {
        code: (error as { code?: string }).code,
        msg: (error as { message?: string }).message,
      });
      return NextResponse.json(
        { ok: false, error: "Failed to record event" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, accepted: true });
  } catch (e) {
    console.error("[events/track] handler error", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
