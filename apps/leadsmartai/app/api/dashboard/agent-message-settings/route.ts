import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  getAgentMessageSettings,
  getAgentMessageSettingsEffective,
  isOnboardingGateActive,
  parseUpsertBody,
  upsertAgentMessageSettings,
} from "@/lib/agent-messaging/settings";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const [settings, effective, gate] = await Promise.all([
      getAgentMessageSettings(agentId),
      getAgentMessageSettingsEffective(agentId),
      isOnboardingGateActive(agentId),
    ]);
    return NextResponse.json({
      ok: true,
      settings,
      effective,
      onboardingGateActive: gate,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("agent-message-settings GET", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const raw = (await req.json()) as Record<string, unknown>;
    const input = parseUpsertBody(raw);
    const settings = await upsertAgentMessageSettings(agentId, input);
    const gate = await isOnboardingGateActive(agentId);
    return NextResponse.json({ ok: true, settings, onboardingGateActive: gate });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = /autosend is locked/i.test(msg) ? 403 : 500;
    console.error("agent-message-settings PATCH", e);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
