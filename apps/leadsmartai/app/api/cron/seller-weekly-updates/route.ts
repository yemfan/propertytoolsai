import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { runWeeklySellerUpdates } from "@/lib/seller-updates/runWeeklyUpdates";

export const runtime = "nodejs";
export const maxDuration = 480;

/**
 * GET /api/cron/seller-weekly-updates
 *
 * Fires every Monday 17:00 UTC (≈9-10am PT, one hour after the
 * agent-facing growth digest so agents get theirs first, then the
 * seller emails go out). Per-listing flow in lib/seller-updates/runWeeklyUpdates.
 *
 * Manual smoke test:
 *   curl "$URL/api/cron/seller-weekly-updates?secret=$CRON_SECRET&limit=1"
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

    const summary = await runWeeklySellerUpdates({ limit, todayIso });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("[seller-weekly-updates] cron:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
