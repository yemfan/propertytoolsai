import { NextResponse } from "next/server";
import { resolveSubjectAndComparables } from "@/lib/comps-ingestion/pipeline";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      address?: string;
      targetCompCount?: number;
    };
    const address = String(body.address ?? "").trim();
    if (!address) {
      return NextResponse.json({ success: false, error: "Missing address" }, { status: 400 });
    }

    const targetCompCount = Math.min(25, Math.max(1, Number(body.targetCompCount ?? 5) || 5));
    const result = await resolveSubjectAndComparables(address, targetCompCount);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("fetch-comps:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch comps" },
      { status: 500 }
    );
  }
}
