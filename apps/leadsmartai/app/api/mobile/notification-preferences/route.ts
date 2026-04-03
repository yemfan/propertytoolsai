import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import {
  getAgentNotificationPreferences,
  upsertAgentNotificationPreferences,
} from "@/lib/notifications/agentNotifications";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const preferences = await getAgentNotificationPreferences(auth.ctx.agentId);
    return NextResponse.json({ ok: true, success: true, preferences });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/mobile/notification-preferences", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const preferences = await upsertAgentNotificationPreferences(auth.ctx.agentId, {
      push_hot_lead: typeof body.push_hot_lead === "boolean" ? body.push_hot_lead : undefined,
      push_missed_call: typeof body.push_missed_call === "boolean" ? body.push_missed_call : undefined,
      push_reminder: typeof body.push_reminder === "boolean" ? body.push_reminder : undefined,
      reminder_digest_minutes:
        typeof body.reminder_digest_minutes === "number"
          ? Math.min(120, Math.max(5, Math.floor(body.reminder_digest_minutes)))
          : undefined,
    });
    return NextResponse.json({ ok: true, success: true, preferences });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("PATCH /api/mobile/notification-preferences", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
