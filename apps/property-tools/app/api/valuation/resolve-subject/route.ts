import { NextResponse } from "next/server";
import { resolveSubjectAndComparables } from "@/lib/comps-ingestion/pipeline";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { address?: string };
    const address = String(body.address ?? "").trim();
    if (!address) {
      return NextResponse.json({ success: false, error: "Missing address" }, { status: 400 });
    }

    const result = await resolveSubjectAndComparables(address, 5);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("resolve-subject:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to resolve subject" },
      { status: 500 }
    );
  }
}
