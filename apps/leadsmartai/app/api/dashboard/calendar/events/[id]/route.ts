import { NextResponse } from "next/server";
import { patchMobileCalendarEvent } from "@/lib/mobile/calendarMobile";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import type { MobileCalendarEventStatus } from "@leadsmart/shared";

export const runtime = "nodejs";

type PatchBody = {
  status?: MobileCalendarEventStatus;
  title?: string;
  description?: string | null;
  startsAt?: string;
  endsAt?: string | null;
};

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { id } = await ctx.params;
    const eventId = String(id ?? "").trim();
    if (!eventId) {
      return NextResponse.json({ ok: false, error: "Missing event id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as PatchBody;
    const event = await patchMobileCalendarEvent({
      agentId,
      eventId,
      status: body.status,
      title: body.title,
      description: body.description,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
    });

    return NextResponse.json({ ok: true, event });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ ok: false, error: "Event not found" }, { status: 404 });
    }
    console.error("dashboard calendar events PATCH", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
