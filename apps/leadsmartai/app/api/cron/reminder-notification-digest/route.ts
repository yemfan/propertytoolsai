import { NextResponse } from "next/server";
import { processReminderNotificationDigest } from "@/lib/notifications/reminderDigest";

export const runtime = "nodejs";

function authorizeCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("x-cron-secret");
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  return token === secret || bearer === secret;
}

export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await processReminderNotificationDigest();
    return NextResponse.json({ ok: true, success: true, ...result });
  } catch (e) {
    console.error("reminder-notification-digest", e);
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
