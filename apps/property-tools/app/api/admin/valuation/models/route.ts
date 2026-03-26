import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { listModels } from "@/lib/ml-registry/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: profile ? 403 : 401 });
    }

    const models = await listModels("valuation_avm");
    return NextResponse.json({ success: true, models });
  } catch (error) {
    console.error("valuation models list error:", error);
    return NextResponse.json({ success: false, error: "Failed to list models" }, { status: 500 });
  }
}
