import { NextResponse } from "next/server";
import { getSupportDashboardOverview } from "@/lib/dashboard/support";
import { getDashboardActor } from "@/lib/dashboard/resolveRole";
import { isStaffRole } from "@/lib/auth/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await getDashboardActor(req);
  if (!actor) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaffRole(actor.role)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start") || undefined;
    const end = searchParams.get("end") || undefined;

    const data = await getSupportDashboardOverview({ start, end });
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error("Support dashboard error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load support dashboard" },
      { status: 500 }
    );
  }
}
