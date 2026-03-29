import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type Body = {
  eventType?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Persists product analytics to `public.events` (service role).
 * Works for anonymous visitors; attaches `user_id` when a session exists.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const eventType = String(body.eventType ?? "").trim();
    if (!eventType) {
      return NextResponse.json(
        { ok: false, error: "eventType is required." },
        { status: 400 }
      );
    }

    const metadata =
      body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? body.metadata
        : {};

    const user = await getUserFromRequest(req);
    const userId = user?.id ?? null;

    const { error } = await supabaseServer.from("events").insert({
      user_id: userId,
      event_type: eventType,
      metadata,
    });

    if (error) {
      console.error("analytics track insert error", error);
      return NextResponse.json(
        { ok: false, error: "Failed to record event." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("POST /api/analytics/track", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
