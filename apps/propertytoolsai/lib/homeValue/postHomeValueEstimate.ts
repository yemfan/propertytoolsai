/**
 * Shared POST handler for home value estimate APIs (`/api/home-value-estimate` and `/api/home-value/estimate`).
 */
import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { normalizeHomeValueEstimateRequestBody } from "@/lib/homeValue/normalizeEstimateRequestBody";
import { runHomeValueEstimatePipeline } from "@/lib/homeValue/runEstimate";

export async function handleHomeValueEstimatePost(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const body = normalizeHomeValueEstimateRequestBody(raw);
    const authUser = await getUserFromRequest(req);
    const userId = authUser?.id ?? null;

    const result = await runHomeValueEstimatePipeline(body, { userId });
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg === "address is required") {
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
    console.error("home-value-estimate", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
