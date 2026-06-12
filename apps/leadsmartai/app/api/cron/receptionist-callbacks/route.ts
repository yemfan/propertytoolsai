import { NextRequest, NextResponse } from "next/server";
import { processDueCallBacks } from "@/lib/missed-call/callbacks";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Every 5 minutes — place due missed-call call-backs (the +5/+10/+30
 * ladder). See lib/missed-call/callbacks.ts for the rules.
 *
 * Auth: Vercel's x-vercel-cron-signature (set automatically) OR
 * Authorization: Bearer <CRON_SECRET> OR ?secret=<CRON_SECRET>.
 * Manual: curl "$URL/api/cron/receptionist-callbacks?secret=$CRON_SECRET"
 */
function authorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron-signature")) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if ((req.headers.get("authorization") ?? "") === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await processDueCallBacks();
  return NextResponse.json({ ok: true, ...result });
}
