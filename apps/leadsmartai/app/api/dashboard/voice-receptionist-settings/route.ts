import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  getReceptionistConfig,
  upsertReceptionistConfig,
  type UpsertReceptionistConfigInput,
} from "@/lib/voice-receptionist/settings";

export const runtime = "nodejs";

function str(v: unknown, max: number): string | undefined {
  return typeof v === "string" ? v.slice(0, max) : undefined;
}

export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const settings = await getReceptionistConfig(agentId);
    return NextResponse.json({ ok: true, settings });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("voice-receptionist-settings GET", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json()) as Record<string, unknown>;

    const input: UpsertReceptionistConfigInput = {};
    if (typeof body.enabled === "boolean") input.enabled = body.enabled;

    const businessName = str(body.businessName, 200);
    if (businessName !== undefined) input.businessName = businessName;

    const businessNameZh = str(body.businessNameZh, 200);
    if (businessNameZh !== undefined) input.businessNameZh = businessNameZh;

    const agentName = str(body.agentName, 100);
    if (agentName !== undefined) input.agentName = agentName;

    const greeting = str(body.greeting, 1000);
    if (greeting !== undefined) input.greeting = greeting;

    const timezone = str(body.timezone, 64);
    if (timezone) input.timezone = timezone;

    const extraNotes = str(body.extraNotes, 4000);
    if (extraNotes !== undefined) input.extraNotes = extraNotes;

    const settings = await upsertReceptionistConfig(agentId, input);
    return NextResponse.json({ ok: true, settings });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("voice-receptionist-settings PATCH", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
