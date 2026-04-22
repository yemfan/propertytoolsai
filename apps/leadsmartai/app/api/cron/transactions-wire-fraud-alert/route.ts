import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { runWireFraudAlerts } from "@/lib/transactions/runWireFraudAlerts";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * GET /api/cron/transactions-wire-fraud-alert
 *
 * Fires every 6 hours (see vercel.json). Sends an SMS to each buyer-rep
 * agent whose active transaction is closing in 24-48h and whose
 * wire-verification task is still incomplete. Dedupe is per
 * (transaction, day) — three closings tomorrow = three SMSes.
 *
 * Manual smoke test:
 *   curl "$URL/api/cron/transactions-wire-fraud-alert?secret=$CRON_SECRET&limit=1"
 */
export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(req.url);
    const rawLimit = url.searchParams.get("limit");
    const limit = rawLimit ? Math.max(0, Math.min(500, Number(rawLimit) || 0)) : 0;
    const todayIso = url.searchParams.get("date") || undefined;

    const summary = await runWireFraudAlerts({ limit, todayIso });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("[wire-fraud-alert] cron:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
