import { NextResponse } from "next/server";
import {
  calculateHomeValueEstimate,
  type EstimateInput,
} from "@/lib/home-value/estimate";

export const runtime = "nodejs";

/**
 * Runs the hybrid home value engine when you already have {@link EstimateInput}
 * (e.g. from a market snapshot layer). Prefer `/api/property/estimate` for
 * address + warehouse comps flow.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as EstimateInput | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "JSON body is required." },
        { status: 400 }
      );
    }

    const result = calculateHomeValueEstimate(body);
    return NextResponse.json({ ok: true, result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    const isValidation =
      /incomplete|required|median price per sqft/i.test(message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: isValidation ? 400 : 500 }
    );
  }
}
