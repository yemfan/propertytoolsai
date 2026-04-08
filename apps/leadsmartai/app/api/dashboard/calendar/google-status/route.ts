import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { isGoogleCalendarConnected } from "@/lib/google-calendar/sync";
import { isGoogleCalendarConfigured } from "@/lib/google-calendar/config";

export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const configured = isGoogleCalendarConfigured();
    const connected = configured ? await isGoogleCalendarConnected(agentId) : false;

    return NextResponse.json({ ok: true, configured, connected });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
