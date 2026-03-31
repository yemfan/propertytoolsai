import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  getAgentVoiceSettings,
  upsertAgentVoiceSettings,
  type UpsertAgentVoiceSettingsInput,
} from "@/lib/agent-voice/settings";
import { findPreset, listPresetsForProvider } from "@/lib/agent-voice/presets";
import type { VoiceDefaultLanguage, VoiceProvider, VoiceSpeakingStyle } from "@/lib/agent-voice/types";

export const runtime = "nodejs";

const PROVIDERS: readonly VoiceProvider[] = ["openai", "elevenlabs"];
const STYLES: readonly VoiceSpeakingStyle[] = ["friendly", "professional", "luxury"];
const LANGS: readonly VoiceDefaultLanguage[] = ["en", "zh"];

function parseProvider(v: unknown): VoiceProvider | undefined {
  if (typeof v !== "string") return undefined;
  return PROVIDERS.includes(v as VoiceProvider) ? (v as VoiceProvider) : undefined;
}

function parseStyle(v: unknown): VoiceSpeakingStyle | undefined {
  if (typeof v !== "string") return undefined;
  return STYLES.includes(v as VoiceSpeakingStyle) ? (v as VoiceSpeakingStyle) : undefined;
}

function parseLang(v: unknown): VoiceDefaultLanguage | undefined {
  if (typeof v !== "string") return undefined;
  return LANGS.includes(v as VoiceDefaultLanguage) ? (v as VoiceDefaultLanguage) : undefined;
}

export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const settings = await getAgentVoiceSettings(agentId);
    const presets = listPresetsForProvider(settings.provider);
    return NextResponse.json({ ok: true, settings, presets });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("agent-voice-settings GET", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json()) as Record<string, unknown>;

    const input: UpsertAgentVoiceSettingsInput = {};

    const p = parseProvider(body.provider);
    if (p) input.provider = p;

    if (typeof body.presetVoiceId === "string" && body.presetVoiceId.trim()) {
      const prov = input.provider ?? (await getAgentVoiceSettings(agentId)).provider;
      if (findPreset(prov, body.presetVoiceId.trim())) {
        input.presetVoiceId = body.presetVoiceId.trim();
      }
    }

    const st = parseStyle(body.speakingStyle);
    if (st) input.speakingStyle = st;

    const dl = parseLang(body.defaultLanguage);
    if (dl) input.defaultLanguage = dl;

    if (typeof body.bilingualEnabled === "boolean") {
      input.bilingualEnabled = body.bilingualEnabled;
    }

    const settings = await upsertAgentVoiceSettings(agentId, input);
    const presets = listPresetsForProvider(settings.provider);
    return NextResponse.json({ ok: true, settings, presets });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("agent-voice-settings PATCH", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
