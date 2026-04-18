import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Retired. Replaced by the unified /api/consumer/saved-searches route
 * which writes to the new public.contact_saved_searches table (one
 * source of truth across leadsmartai agents + propertytoolsai
 * consumers). The legacy public.lead_saved_searches table was dropped
 * in migration 20260480600000.
 *
 * Any stale clients calling this path get a 410 Gone with the new
 * endpoint in the response so the failure mode is debuggable rather
 * than silently wrong.
 */

const RETIRED_RESPONSE = {
  success: false,
  error:
    "This endpoint is retired. Use POST /api/consumer/saved-searches with { name, criteria, alertFrequency? }.",
  replacement: "/api/consumer/saved-searches",
};

export async function POST() {
  return NextResponse.json(RETIRED_RESPONSE, { status: 410 });
}

export async function GET() {
  return NextResponse.json(RETIRED_RESPONSE, { status: 410 });
}
