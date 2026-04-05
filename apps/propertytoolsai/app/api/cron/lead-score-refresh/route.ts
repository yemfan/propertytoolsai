import { NextResponse } from "next/server";
import { rescoreAllLeadsDaily } from "@/lib/leadScoring";
import { verifyCronRequest } from "@/lib/seoOptimization/cronAuth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await rescoreAllLeadsDaily();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
