import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { runOpenHouseFollowups } from "@/lib/open-houses/runFollowups";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/cron/open-house-followups
 *
 * Fires hourly. Sends thank-you emails (24h after sign-in) and day-3
 * check-in SMS to visitors who opted in. See lib/open-houses/runFollowups.ts.
 *
 * Manual smoke test:
 *   curl "$URL/api/cron/open-house-followups?secret=$CRON_SECRET&limit=1"
 */
export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(req.url);
    const rawLimit = url.searchParams.get("limit");
    const limit = rawLimit ? Math.max(0, Math.min(1000, Number(rawLimit) || 0)) : undefined;
    const summary = await runOpenHouseFollowups({ limit });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("[open-house-followups] cron:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
