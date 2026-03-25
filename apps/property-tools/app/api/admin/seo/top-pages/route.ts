import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { getTopSeoPagesByRevenue } from "@/lib/seo-generator/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: profile ? 403 : 401 });
    }

    const { searchParams } = new URL(req.url);
    const limitRaw = searchParams.get("limit");
    const limit = limitRaw ? Math.min(100, Math.max(1, Number(limitRaw) || 20)) : 20;

    const rows = await getTopSeoPagesByRevenue(limit);
    return NextResponse.json({ success: true, rows });
  } catch (error) {
    console.error("seo top-pages error:", error);
    return NextResponse.json({ success: false, error: "Failed to load top SEO pages" }, { status: 500 });
  }
}
