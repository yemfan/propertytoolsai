import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import {
  listAgentInboxNotifications,
  markAllAgentNotificationsRead,
  markAgentNotificationRead,
} from "@/lib/notifications/agentNotifications";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const url = new URL(req.url);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "30", 10) || 30)
    );
    const notifications = await listAgentInboxNotifications(auth.ctx.agentId, limit);
    return NextResponse.json({
      ok: true,
      success: true,
      notifications,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/mobile/notifications", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      markAllRead?: boolean;
      notificationId?: string;
      read?: boolean;
    };

    if (body.markAllRead) {
      await markAllAgentNotificationsRead(auth.ctx.agentId);
      return NextResponse.json({ ok: true, success: true });
    }

    const id = typeof body.notificationId === "string" ? body.notificationId.trim() : "";
    if (!id) {
      return NextResponse.json(
        { ok: false, success: false, error: "notificationId required" },
        { status: 400 }
      );
    }

    await markAgentNotificationRead(auth.ctx.agentId, id, body.read !== false);
    return NextResponse.json({ ok: true, success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/mobile/notifications", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
