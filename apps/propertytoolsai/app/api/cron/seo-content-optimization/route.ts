import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/seoOptimization/cronAuth";
import { runWeeklyBatch } from "@/lib/seoOptimization";
import { resolveWeeklyBatchLimit } from "@/lib/seoOptimization/resolveWeeklyLimit";

export const runtime = "nodejs";

/**
 * Weekly cron: optimize pages with recent performance rows (or all pages if SEO_OPT_INCLUDE_ALL_PAGES=true).
 * Batch size is `SEO_OPT_WEEKLY_LIMIT` (must be > 0). Optional `?limit=` overrides for manual runs.
 * When limit is 0 or unset, returns `{ ok: true, skipped: true }` without calling OpenAI.
 *
 * GET /api/cron/seo-content-optimization?secret=...
 * Headers: Authorization: Bearer CRON_SECRET (if CRON_SECRET is set)
 */
export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = resolveWeeklyBatchLimit(url.searchParams.get("limit"), process.env.SEO_OPT_WEEKLY_LIMIT);
  const force = url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true";

  if (limit <= 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason:
        "SEO_OPT_WEEKLY_LIMIT is 0 or unset. Set SEO_OPT_WEEKLY_LIMIT to a positive integer to enable the weekly SEO batch.",
    });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY not configured" }, { status: 503 });
  }

  try {
    const out = await runWeeklyBatch({ limit, force });
    return NextResponse.json({ ok: true, ...out });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
