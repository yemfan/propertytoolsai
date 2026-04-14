import { NextResponse } from "next/server";
import { getPlatformOverview } from "@/lib/dashboard/admin";
import { requireRoleRoute } from "@/lib/auth/requireRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireRoleRoute(["admin"]);
  if (auth.ok === false) return auth.response;

  try {
    const data = await getPlatformOverview();
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error("Platform overview error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load platform overview" },
      { status: 500 }
    );
  }
}
