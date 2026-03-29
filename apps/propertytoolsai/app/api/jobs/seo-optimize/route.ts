import { NextResponse } from "next/server";
import { runSeoOptimizationBatch } from "@/lib/seo-generator/optimizer";
import { verifyCronRequest } from "@/lib/seoOptimization/cronAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function parseOpts(url: URL) {
  const minVisits = Math.max(0, Number(url.searchParams.get("minVisits")) || 100);
  const maxLeadCountExclusive = Math.max(1, Number(url.searchParams.get("maxLeadCountExclusive")) || 5);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 25));
  return { minVisits, maxLeadCountExclusive, limit };
}

/** Vercel Cron: GET. Manual: POST with same query string. */
export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json({ success: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  try {
    const opts = parseOpts(new URL(req.url));
    const result = await runSeoOptimizationBatch(opts);
    return NextResponse.json({ success: true, ...opts, ...result });
  } catch (error) {
    console.error("seo-optimize job error:", error);
    return NextResponse.json({ success: false, error: "Failed SEO optimize job" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
