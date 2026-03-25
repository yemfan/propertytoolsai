import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { listSeoPages } from "@/lib/seo-generator/db";

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
    const limit = limitRaw ? Math.min(500, Math.max(1, Number(limitRaw) || 100)) : 100;

    const rows = await listSeoPages(limit);
    return NextResponse.json({ success: true, rows });
  } catch (error) {
    console.error("seo list error:", error);
    return NextResponse.json({ success: false, error: "Failed to list SEO pages" }, { status: 500 });
  }
}
