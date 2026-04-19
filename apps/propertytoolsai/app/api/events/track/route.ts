import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { isBehaviorEventType } from "@/lib/contacts/types";

export const runtime = "nodejs";

/**
 * Behavioral event ingestion on the consumer site.
 * Mirrors the /api/events/track endpoint in the leadsmartai app — both
 * write to the same public.contact_events table. Separate route so the
 * two apps deploy independently; the leadsmartai scoring cron reads
 * everything regardless of which app wrote it.
 *
 * Resolution priority for contactId:
 *   1. Explicit body.contactId (e.g., from server-rendered pages)
 *   2. Logged-in auth user → contacts.user_id (via authFromRequest)
 *   3. body.sessionId → contacts.source_session_id (pre-unlock flow)
 *
 * Unresolved events are accept-and-dropped so client trackers don't
 * spam errors for anonymous pre-signup activity.
 */

const MAX_PAYLOAD_BYTES = 4096;

type PostBody = {
  contactId?: unknown;
  eventType?: unknown;
  payload?: unknown;
  sessionId?: unknown;
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

    // 1. Explicit contactId
    let contactId: string | null =
      typeof body.contactId === "string" && body.contactId.trim()
        ? body.contactId.trim()
        : null;

    // 2. Resolve from auth user
    if (!contactId) {
      const user = await getUserFromRequest(req);
      if (user?.id) {
        const { data: byUser } = await supabaseAdmin
          .from("contacts")
          .select("id")
          .eq("user_id", user.id as never)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (byUser) contactId = String((byUser as { id: string }).id);

        if (!contactId && user.email) {
          const { data: byEmail } = await supabaseAdmin
            .from("contacts")
            .select("id")
            .ilike("email", user.email)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (byEmail) contactId = String((byEmail as { id: string }).id);
        }
      }
    }

    // 3. Resolve from sessionId
    if (!contactId && typeof body.sessionId === "string" && body.sessionId.trim()) {
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
      return NextResponse.json(
        { ok: true, accepted: false, reason: "no contact" },
        { status: 200 },
      );
    }

    // Lookup agent_id from contact for agent-scoped rollups
    const { data: contactRow } = await supabaseAdmin
      .from("contacts")
      .select("agent_id")
      .eq("id", contactId)
      .maybeSingle();
    const agentId = (contactRow as { agent_id: unknown } | null)?.agent_id ?? null;

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
      source: "consumer_web",
    } as never);

    if (error) {
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
