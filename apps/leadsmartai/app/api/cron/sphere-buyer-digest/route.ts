import { NextResponse } from "next/server";

import { verifyCronRequest } from "@/lib/cronAuth";
import { runBuyerDigestForAllAgents } from "@/lib/buyerPrediction/dailyBuyerDigestCron";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Daily SOI BUYER digest cron — dual of /api/cron/sphere-seller-digest.
 * Scans every agent for `high`-likelihood next-purchase contacts, dedups
 * against the last 30 days of `sphere_buyer_high_notified` events, and
 * sends each agent a single morning SMS summarizing the top-N.
 *
 * Schedule (vercel.json): 16:00 UTC daily — 12 PM ET / 9 AM PT. Runs
 * 2 hours after the seller digest (14:00 UTC) so agents don't get a wall
 * of two SMSes back-to-back.
 *
 * Query overrides for manual testing:
 *   ?agentId=<id>   limit to one agent
 *   ?dryRun=1       compute + format, skip send
 *   ?limit=<n>      candidates per agent (default 50)
 */
export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agentId") ?? undefined;
    const dryRun = url.searchParams.get("dryRun") === "1";
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw != null ? Number(limitRaw) : undefined;

    const result = await runBuyerDigestForAllAgents({
      agentId,
      dryRun,
      limit: limit != null && Number.isFinite(limit) ? limit : undefined,
    });

    // Same compaction as the seller-digest route — keep big-fleet payloads
    // bounded; full per-agent results stay in server logs.
    const compactResults =
      result.results.length > 25
        ? result.results.slice(0, 25).concat([
            {
              agentId: "__truncated__",
              sent: false,
              reason: `truncated: ${result.results.length - 25} more results in logs`,
            },
          ])
        : result.results;

    return NextResponse.json({
      ok: true,
      totalAgents: result.totalAgents,
      sent: result.sent,
      skipped: result.skipped,
      failed: result.failed,
      dryRun,
      results: compactResults,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("cron/sphere-buyer-digest", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
