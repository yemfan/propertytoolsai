import { NextResponse } from "next/server";
import { listRecentBookingLinksForLead } from "@/lib/mobile/calendarMobile";
import { getCurrentAgentContext } from "@/lib/dashboardService";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const leadId = new URL(req.url).searchParams.get("leadId")?.trim();
    if (!leadId) {
      return NextResponse.json({ ok: false, error: "leadId is required" }, { status: 400 });
    }

    const links = await listRecentBookingLinksForLead({
      agentId,
      leadId,
      limit: 25,
    });

    return NextResponse.json({ ok: true, links });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("dashboard booking-links GET", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
