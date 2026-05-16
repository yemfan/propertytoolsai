import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { sendDueRenewalReminders } from "@/lib/billing/sendRenewalReminders";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/cron/annual-renewal-reminders
 *
 * Daily cron: sends the 30-day reminder for annual subscriptions
 * about to renew. Required by California BPC §17602 and New York
 * GBL §527-a — see `lib/email/annualRenewalReminder.ts` for context.
 *
 * Manual smoke test:
 *   curl "$URL/api/cron/annual-renewal-reminders?secret=$CRON_SECRET"
 */
export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await sendDueRenewalReminders();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("[annual-renewal-reminders] cron:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
