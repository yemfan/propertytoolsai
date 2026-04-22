import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { runWeeklyGrowthDigest } from "@/lib/growth/runWeeklyDigest";

export const runtime = "nodejs";
// Per-agent flow: 1 cache check + 1 prefs lookup + 1 Claude generate
// (15-25s each) + 1 sendEmail + log updates. Budget 8 minutes for the
// batch. We cap at 500 agents per run; real volume will be a fraction.
export const maxDuration = 480;

/**
 * GET /api/cron/growth-weekly-digest
 *
 * Fires every Monday 16:00 UTC (≈8-9am PT). Sends a top-3 opportunity
 * digest email to each active agent who hasn't opted out. See
 * lib/growth/runWeeklyDigest.ts for the per-agent flow.
 *
 * Manual smoke test:
 *   curl "$URL/api/cron/growth-weekly-digest?secret=$CRON_SECRET&limit=1"
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

    const summary = await runWeeklyGrowthDigest({ limit, todayIso });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("[growth-weekly-digest] cron:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
