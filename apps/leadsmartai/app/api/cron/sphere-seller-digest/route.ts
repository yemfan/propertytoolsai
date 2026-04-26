import { NextResponse } from "next/server";

import { verifyCronRequest } from "@/lib/cronAuth";
import { runSphereSellerDigestForAllAgents } from "@/lib/spherePrediction/dailyDigestCron";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Daily SOI seller-digest. Runs in the morning, scans every agent, finds
 * `high`-likelihood past_client / sphere contacts that haven't been
 * notified in the last 30 days, and sends each agent a single summary
 * SMS with the top-N candidates (one digest per agent — not one per
 * candidate).
 *
 * Query overrides for manual testing:
 *   ?agentId=<id>   limit the run to one agent
 *   ?dryRun=1       compute + format the digest, skip the SMS send
 *   ?limit=<n>      cap candidates loaded per agent (default 50)
 *
 * Auth: standard Vercel-Cron `Authorization: Bearer <CRON_SECRET>`.
 *   Local dev / curl-based testing also accepts `?secret=<CRON_SECRET>`.
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

    const result = await runSphereSellerDigestForAllAgents({
      agentId,
      dryRun,
      limit: limit != null && Number.isFinite(limit) ? limit : undefined,
    });

    // Trim per-agent results in the response when we ran across many agents —
    // the full results stay in server logs, but a 500-agent payload is not
    // useful in the cron's HTTP body.
    const compactResults =
      result.results.length > 25
        ? result.results.slice(0, 25).concat([
            // synthetic tail row so the consumer sees the truncation
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
    console.error("cron/sphere-seller-digest", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
