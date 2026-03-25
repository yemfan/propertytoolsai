import { NextResponse } from "next/server";
import { staleRowToInput, generateSeoPagesBatch } from "@/lib/seo-generator/batch";
import { findStaleSeoPages } from "@/lib/seo-generator/db";
import { verifyCronRequest } from "@/lib/seoOptimization/cronAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function parseBody(req: Request): Promise<{ hours: number; limit: number }> {
  let hours = 168;
  let limit = 200;
  try {
    const body = await req.json();
    if (typeof body?.hours === "number" && Number.isFinite(body.hours)) hours = body.hours;
    if (typeof body?.limit === "number" && Number.isFinite(body.limit)) limit = body.limit;
  } catch {
    /* empty or non-JSON */
  }
  return { hours, limit };
}

async function runRefresh(hours: number, limit: number) {
  const staleRows = await findStaleSeoPages(hours, limit);
  const inputs = staleRows.map(staleRowToInput);
  const results = await generateSeoPagesBatch(inputs);
  return {
    refreshed: inputs.length,
    successCount: results.filter((r) => r.success).length,
    failureCount: results.filter((r) => !r.success).length,
    results,
  };
}

/** Vercel Cron uses GET. Manual runs: POST with optional JSON `{ hours, limit }`. */
export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json({ success: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  try {
    const out = await runRefresh(168, 200);
    return NextResponse.json({ success: true, ...out });
  } catch (error) {
    console.error("seo refresh job error:", error);
    return NextResponse.json({ success: false, error: "Failed SEO refresh job" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json({ success: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  try {
    const { hours, limit } = await parseBody(req);
    const out = await runRefresh(hours, limit);
    return NextResponse.json({ success: true, ...out });
  } catch (error) {
    console.error("seo refresh job error:", error);
    return NextResponse.json({ success: false, error: "Failed SEO refresh job" }, { status: 500 });
  }
}
