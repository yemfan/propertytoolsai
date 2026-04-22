import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { runOverdueNudges } from "@/lib/transactions/runOverdueNudges";

export const runtime = "nodejs";
// 5-minute max — most runs are far faster but per-agent sendEmail can be slow
// if Resend throttles. Default 10s would cut the batch short.
export const maxDuration = 300;

/**
 * GET /api/cron/transactions-overdue-nudges
 *
 * Fired daily by Vercel Cron (see apps/leadsmartai/vercel.json). Emails
 * an overdue + upcoming-72h task digest to each agent with active
 * transaction deals. See lib/transactions/runOverdueNudges.ts for the
 * per-agent flow and dedupe semantics.
 *
 * Manual invocation for smoke-testing:
 *   curl "https://…/api/cron/transactions-overdue-nudges?secret=$CRON_SECRET&limit=1"
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

    const summary = await runOverdueNudges({ limit, todayIso });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("[overdue-nudges] cron:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
