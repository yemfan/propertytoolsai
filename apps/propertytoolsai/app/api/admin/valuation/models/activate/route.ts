import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { activateModel } from "@/lib/ml-registry/service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: profile ? 403 : 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { modelId?: string };
    if (!body?.modelId?.trim()) {
      return NextResponse.json({ success: false, error: "Missing modelId" }, { status: 400 });
    }

    const model = await activateModel(body.modelId.trim(), "valuation_avm");
    return NextResponse.json({ success: true, model });
  } catch (error) {
    console.error("valuation activate model error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to activate model" },
      { status: 500 }
    );
  }
}
