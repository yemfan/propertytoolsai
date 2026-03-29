import { NextResponse } from "next/server";
import { getPlatformOverview } from "@/lib/dashboard/admin";
import { getDashboardActor } from "@/lib/dashboard/resolveRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await getDashboardActor(req);
  if (!actor) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (actor.role !== "admin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start") || undefined;
    const end = searchParams.get("end") || undefined;

    const data = await getPlatformOverview({ start, end });
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error("Platform overview error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load platform overview" },
      { status: 500 }
    );
  }
}
