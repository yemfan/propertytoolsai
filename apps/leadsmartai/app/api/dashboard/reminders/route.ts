import { NextResponse } from "next/server";
import { getMobileReminders } from "@/lib/mobile/remindersMobile";
import { getCurrentAgentContext } from "@/lib/dashboardService";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const data = await getMobileReminders(agentId);
    return NextResponse.json({ ok: true, ...data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("dashboard reminders GET", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
