import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/seoOptimization/cronAuth";
import { autoQueueDailyExpansion, runExpansionBatch } from "@/lib/seo-generator/expansion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function runJob() {
  const queued = await autoQueueDailyExpansion();
  const batch = await runExpansionBatch(75);
  return {
    queuedCount: Array.isArray(queued) ? queued.length : 0,
    generatedCount: batch.generated,
    results: batch.results,
  };
}

/** Vercel Cron uses GET. Manual runs: POST with same auth. */
export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json({ success: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  try {
    const out = await runJob();
    return NextResponse.json({ success: true, ...out });
  } catch (error) {
    console.error("seo expand job error:", error);
    return NextResponse.json({ success: false, error: "Failed SEO expand job" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json({ success: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  try {
    const out = await runJob();
    return NextResponse.json({ success: true, ...out });
  } catch (error) {
    console.error("seo expand job error:", error);
    return NextResponse.json({ success: false, error: "Failed SEO expand job" }, { status: 500 });
  }
}
