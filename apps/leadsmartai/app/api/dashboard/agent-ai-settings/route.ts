import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  upsertAgentAiSettings,
  getAgentAiSettings,
  type UpsertAgentAiSettingsInput,
} from "@/lib/agent-ai/settings";
import type { AgentAiDefaultLanguage, AiPersonality } from "@/lib/agent-ai/types";

export const runtime = "nodejs";

const PERSONALITIES: readonly AiPersonality[] = ["friendly", "professional", "luxury"];
const LANGUAGES: readonly AgentAiDefaultLanguage[] = ["en", "zh", "auto"];

function parsePersonality(v: unknown): AiPersonality | undefined {
  if (typeof v !== "string") return undefined;
  return PERSONALITIES.includes(v as AiPersonality) ? (v as AiPersonality) : undefined;
}

function parseLanguage(v: unknown): AgentAiDefaultLanguage | undefined {
  if (typeof v !== "string") return undefined;
  return LANGUAGES.includes(v as AgentAiDefaultLanguage) ? (v as AgentAiDefaultLanguage) : undefined;
}

export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const settings = await getAgentAiSettings(agentId);
    return NextResponse.json({ ok: true, settings });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("agent-ai-settings GET", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json()) as Record<string, unknown>;

    const input: UpsertAgentAiSettingsInput = {};

    if ("personality" in body) {
      const p = parsePersonality(body.personality);
      if (p) input.personality = p;
    }
    if ("defaultLanguage" in body) {
      const l = parseLanguage(body.defaultLanguage);
      if (l) input.defaultLanguage = l;
    }
    if ("bilingualEnabled" in body && typeof body.bilingualEnabled === "boolean") {
      input.bilingualEnabled = body.bilingualEnabled;
    }
    if ("styleNotes" in body) {
      if (body.styleNotes === null || body.styleNotes === "") {
        input.styleNotes = null;
      } else if (typeof body.styleNotes === "string") {
        input.styleNotes = body.styleNotes.trim().slice(0, 500);
      }
    }

    const settings = await upsertAgentAiSettings(agentId, input);
    return NextResponse.json({ ok: true, settings });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("agent-ai-settings PATCH", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
