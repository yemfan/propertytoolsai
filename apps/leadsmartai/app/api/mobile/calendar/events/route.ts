import { NextResponse } from "next/server";
import { createMobileCalendarEvent, listMobileCalendarEvents } from "@/lib/mobile/calendarMobile";
import { requireMobileAgent } from "@/lib/mobile/auth";
import type { MobileCalendarProvider } from "@leadsmart/shared";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const url = new URL(req.url);
    const fromIso = url.searchParams.get("from") ?? undefined;
    const toIso = url.searchParams.get("to") ?? undefined;
    const leadId = url.searchParams.get("contact_id")?.trim() || undefined;
    const events = await listMobileCalendarEvents({
      agentId: auth.ctx.agentId,
      fromIso: fromIso ?? undefined,
      toIso: toIso ?? undefined,
      leadId,
    });
    return NextResponse.json({ ok: true, success: true, events });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/mobile/calendar/events", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}

type PostBody = {
  contact_id?: string;
  title?: string;
  description?: string | null;
  starts_at?: string;
  ends_at?: string | null;
  timezone?: string | null;
  calendar_provider?: MobileCalendarProvider | null;
  external_event_id?: string | null;
  external_calendar_id?: string | null;
};

export async function POST(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as PostBody;
    const leadId = String(body.contact_id ?? "").trim();
    const title = String(body.title ?? "").trim();
    const startsAt = String(body.starts_at ?? "").trim();
    if (!leadId) {
      return NextResponse.json({ ok: false, success: false, error: "lead_id is required" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ ok: false, success: false, error: "title is required" }, { status: 400 });
    }
    if (!startsAt) {
      return NextResponse.json({ ok: false, success: false, error: "starts_at is required" }, { status: 400 });
    }

    const event = await createMobileCalendarEvent({
      agentId: auth.ctx.agentId,
      leadId,
      title,
      description: body.description,
      startsAt,
      endsAt: body.ends_at,
      timezone: body.timezone,
      calendarProvider: body.calendar_provider ?? "local",
      externalEventId: body.external_event_id,
      externalCalendarId: body.external_calendar_id,
    });

    return NextResponse.json({ ok: true, success: true, event });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ ok: false, success: false, error: "Lead not found" }, { status: 404 });
    }
    console.error("POST /api/mobile/calendar/events", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
