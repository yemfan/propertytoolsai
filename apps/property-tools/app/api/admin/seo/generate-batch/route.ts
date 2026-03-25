import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { generateSeoPagesBatch } from "@/lib/seo-generator/batch";
import { buildSeoSeedInputs, type SeoSeedConfig } from "@/lib/seo-generator/seeds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: profile ? 403 : 401 });
    }

    const body = await req.json();
    const config = body?.config as SeoSeedConfig | undefined;
    if (!config?.cities?.length) {
      return NextResponse.json({ success: false, error: "Missing cities config" }, { status: 400 });
    }

    const inputs = buildSeoSeedInputs(config);
    const results = await generateSeoPagesBatch(inputs);

    return NextResponse.json({
      success: true,
      totalInputs: inputs.length,
      successCount: results.filter((r) => r.success).length,
      failureCount: results.filter((r) => !r.success).length,
      results,
    });
  } catch (error) {
    console.error("seo batch generate error:", error);
    return NextResponse.json({ success: false, error: "Failed to run SEO batch" }, { status: 500 });
  }
}
