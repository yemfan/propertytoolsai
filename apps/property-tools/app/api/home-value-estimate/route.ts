import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { normalizeHomeValueEstimateRequestBody } from "@/lib/homeValue/normalizeEstimateRequestBody";
import { runHomeValueEstimatePipeline } from "@/lib/homeValue/runEstimate";

export const runtime = "nodejs";

/**
 * POST /api/home-value-estimate — canonical home value estimate API.
 * `POST /api/home-value/estimate` rewrites here (see next.config.js).
 *
 * Accepts flat `HomeValueEstimateRequest` or nested `{ address, details?, context? }`.
 */
export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const body = normalizeHomeValueEstimateRequestBody(raw);
    const authUser = await getUserFromRequest(req);
    const userId = authUser?.id ?? null;

    const result = await runHomeValueEstimatePipeline(body, { userId });
    return NextResponse.json(result);
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    if (msg === "address is required") {
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
    console.error("home-value-estimate", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
