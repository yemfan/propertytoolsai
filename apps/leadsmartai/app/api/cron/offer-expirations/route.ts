import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { runOfferExpirationAlerts } from "@/lib/offer-expirations/runAlerts";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/cron/offer-expirations
 *
 * Fires every 2 hours. Sends warning (24h out) + final (2h out)
 * alerts to agents whose offers are about to expire. See
 * lib/offer-expirations/runAlerts.ts.
 *
 * Manual smoke test:
 *   curl "$URL/api/cron/offer-expirations?secret=$CRON_SECRET"
 */
export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runOfferExpirationAlerts();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("[offer-expirations] cron:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
