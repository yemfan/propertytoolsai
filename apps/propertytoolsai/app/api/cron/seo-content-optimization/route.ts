import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/seoOptimization/cronAuth";
import { runWeeklyBatch } from "@/lib/seoOptimization";

export const runtime = "nodejs";

/**
 * Weekly cron: optimize pages with recent performance rows (or all pages if SEO_OPT_INCLUDE_ALL_PAGES=true).
 * GET /api/cron/seo-content-optimization?secret=...
 * Headers: Authorization: Bearer CRON_SECRET (if CRON_SECRET is set)
 */
export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY not configured" }, { status: 503 });
  }

  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? process.env.SEO_OPT_WEEKLY_LIMIT ?? 50);
    const force = url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true";

    const out = await runWeeklyBatch({
      limit: Number.isFinite(limit) ? limit : 50,
      force,
    });
    return NextResponse.json({ ok: true, ...out });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
