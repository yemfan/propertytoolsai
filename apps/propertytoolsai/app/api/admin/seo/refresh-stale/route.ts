import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { staleRowToInput, generateSeoPagesBatch } from "@/lib/seo-generator/batch";
import { findStaleSeoPages } from "@/lib/seo-generator/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: profile ? 403 : 401 });
    }

    let hours = 168;
    let limit = 200;
    try {
      const body = await req.json();
      if (typeof body?.hours === "number" && Number.isFinite(body.hours)) hours = body.hours;
      if (typeof body?.limit === "number" && Number.isFinite(body.limit)) limit = body.limit;
    } catch {
      /* empty body */
    }

    const staleRows = await findStaleSeoPages(hours, limit);
    const inputs = staleRows.map(staleRowToInput);
    const results = await generateSeoPagesBatch(inputs);

    return NextResponse.json({
      success: true,
      count: inputs.length,
      successCount: results.filter((r) => r.success).length,
      failureCount: results.filter((r) => !r.success).length,
      results,
    });
  } catch (error) {
    console.error("seo refresh stale error:", error);
    return NextResponse.json({ success: false, error: "Failed to refresh stale pages" }, { status: 500 });
  }
}
