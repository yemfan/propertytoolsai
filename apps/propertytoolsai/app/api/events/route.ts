import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { insertToolEvent } from "@/lib/homeValue/funnelPersistence";

export const runtime = "nodejs";

type Body = {
  session_id?: string;
  tool_name?: string;
  event_name?: string;
  metadata?: Record<string, unknown>;
};

/**
 * POST /api/events
 * Product funnel analytics — `tool_events` (session-scoped).
 * Also consider /api/analytics/track for `public.events` (event_type).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const sessionId = String(body.session_id ?? "").trim();
    const toolName = String(body.tool_name ?? "").trim();
    const eventName = String(body.event_name ?? "").trim();

    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "session_id is required" }, { status: 400 });
    }
    if (!toolName || !eventName) {
      return NextResponse.json(
        { ok: false, error: "tool_name and event_name are required" },
        { status: 400 }
      );
    }

    const user = await getUserFromRequest(req);
    const userId = user?.id ?? null;

    const metadata =
      body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? body.metadata
        : {};

    await insertToolEvent({
      sessionId,
      userId,
      toolName,
      eventName,
      metadata,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("POST /api/events", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
