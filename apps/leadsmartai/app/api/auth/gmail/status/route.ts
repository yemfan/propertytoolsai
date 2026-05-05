import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { isGmailConfigured } from "@/lib/gmail/config";
import { isGmailConnected } from "@/lib/gmail/tokens";

/**
 * GET /api/auth/gmail/status
 *
 * Returns whether the integration is configured at the platform level
 * (env vars present) and whether THIS agent has connected. Same
 * shape as the calendar status endpoint so the connect-button UI
 * patterns can mirror.
 */
export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const configured = isGmailConfigured();
    const connected = configured ? await isGmailConnected(String(agentId)) : false;
    return NextResponse.json({ ok: true, configured, connected });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
