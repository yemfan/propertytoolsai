import { NextResponse } from "next/server";
import { processDueFollowupJobs } from "@/lib/followUp";
import { verifyCronRequest } from "@/lib/cronAuth";

export const runtime = "nodejs";

/**
 * Vercel Cron: process scheduled AI follow-ups (1h / 24h / 3d) when lead has not replied.
 */
export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processDueFollowupJobs(40);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("cron ai-followups", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
