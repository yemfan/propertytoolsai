import { VOICE_TRANSCRIPT_RESPONSES_INSTRUCTIONS } from "@/lib/ai-call/prompts";
import type { VoiceSessionLanguage } from "@/lib/ai-call/voice-language";
import { getLocale, type LocaleId } from "@/lib/locales/registry";
import { getPersonalityLayers } from "./profiles";
import type { AgentAiSettings } from "./types";

const MAX_STYLE_NOTES_IN_PROMPT = 500;

function trimStyleNotes(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;
  return t.slice(0, MAX_STYLE_NOTES_IN_PROMPT);
}

/**
 * Optional bilingual + default-language hints. Does not override user language when obvious from the thread.
 */
export function buildLanguagePreferenceBlock(settings: AgentAiSettings): string {
  const lines: string[] = [];
  if (settings.defaultLanguage === "en") {
    lines.push("Default to clear English when the thread language is ambiguous.");
  } else if (settings.defaultLanguage === "zh") {
    lines.push("When the thread language is ambiguous, prefer Simplified Chinese for replies.");
  } else {
    lines.push("Match the lead’s language when clear; if ambiguous, choose the language that best fits the last message.");
  }
  if (settings.bilingualEnabled) {
    lines.push(
      "The agent serves English and Chinese leads: you may reply in English or Simplified Chinese to match the user. Do not mix languages in one SMS unless mirroring the user. Accuracy and compliance rules still apply."
    );
  }
  if (!lines.length) return "";
  return `\nLanguage preference (style only):\n${lines.map((l) => `- ${l}`).join("\n")}`;
}

/**
 * Per-lead outbound locale directive, resolved via
 * `resolveLeadOutboundLocale()` upstream and sourced from the locale
 * registry's `outboundToneDirective`. When passed, this DOMINATES the
 * agent's generic `buildLanguagePreferenceBlock` because it reflects a
 * specific decision about this specific lead.
 *
 * No-op when locale is EN — the base prompt is already in English and
 * adding "reply in English" just pads the context window.
 */
export function buildOutboundLocaleDirective(locale: LocaleId): string {
  if (locale === "en") return "";
  const entry = getLocale(locale);
  return `\nOutbound language (HARD REQUIREMENT — this lead's preferred language):\n${entry.outboundToneDirective}`;
}

export function appendAgentStyleNotes(base: string, settings: AgentAiSettings): string {
  const notes = trimStyleNotes(settings.styleNotes);
  if (!notes) return base;
  return `${base.trim()}\n\nAgent style notes (tone/vocabulary only — never fabricate facts or skip compliance):\n${notes}`;
}

/**
 * Full system `instructions` for SMS assistant Responses API calls.
 *
 * When `outboundLocale` is passed (resolved from contact's preferred language
 * falling through to agent's `default_outbound_language`), the registry's
 * per-locale tone directive replaces the generic agent language-preference
 * block — the lead-specific decision is more authoritative.
 */
export function buildSmsSystemInstructions(
  baseSystemPrompt: string,
  settings: AgentAiSettings,
  outboundLocale?: LocaleId,
): string {
  const layers = getPersonalityLayers(settings.personality);
  const withPersonality = `${baseSystemPrompt.trim()}\n\n${layers.sms}`;
  const langBlock = outboundLocale
    ? buildOutboundLocaleDirective(outboundLocale)
    : buildLanguagePreferenceBlock(settings);
  const withLang = `${withPersonality}${langBlock}`;
  return appendAgentStyleNotes(withLang, settings);
}

/**
 * Full system `instructions` for email assistant Responses API calls.
 *
 * See `buildSmsSystemInstructions` for the `outboundLocale` semantics.
 */
export function buildEmailSystemInstructions(
  baseSystemPrompt: string,
  settings: AgentAiSettings,
  outboundLocale?: LocaleId,
): string {
  const layers = getPersonalityLayers(settings.personality);
  const withPersonality = `${baseSystemPrompt.trim()}\n\n${layers.email}`;
  const langBlock = outboundLocale
    ? buildOutboundLocaleDirective(outboundLocale)
    : buildLanguagePreferenceBlock(settings);
  const withLang = `${withPersonality}${langBlock}`;
  return appendAgentStyleNotes(withLang, settings);
}

/**
 * Instructions for voice call transcript JSON analysis — classification rules stay in `VOICE_TRANSCRIPT_RESPONSES_INSTRUCTIONS`.
 */
export function buildVoiceTranscriptAnalysisInstructions(
  settings: AgentAiSettings,
  outputLanguage?: VoiceSessionLanguage
): string {
  const base = VOICE_TRANSCRIPT_RESPONSES_INSTRUCTIONS.trim();
  const layers = getPersonalityLayers(settings.personality);
  let out = `${base}\n\n${layers.voiceTranscript.trim()}`;
  out = appendAgentStyleNotes(out, settings);

  if (outputLanguage === "zh") {
    out += `\n\nWrite the summary and each reasoning string in Simplified Chinese. Keep inferred_intent enum values exactly as specified (English snake_case).`;
  } else {
    out += `\n\nWrite the summary and reasoning strings in English.`;
  }
  return out.trim();
}

/**
 * Future: OpenAI Realtime / conversational session — full rules + tone layer.
 */
export function buildVoiceRealtimeSystemInstructions(
  voiceAssistantRules: string,
  settings: AgentAiSettings
): string {
  const layers = getPersonalityLayers(settings.personality);
  const withPersonality = `${voiceAssistantRules.trim()}\n\n${layers.voiceRealtime}`;
  const withLang = `${withPersonality}${buildLanguagePreferenceBlock(settings)}`;
  return appendAgentStyleNotes(withLang, settings);
}

/**
 * System instructions for greeting JSON generator (short CRM greetings).
 */
export function buildGreetingGeneratorSystemInstructions(settings: AgentAiSettings): string {
  const layers = getPersonalityLayers(settings.personality);
  const base = `You write short JSON-only outputs for a real estate CRM greeting generator. Follow the user rules exactly. ${layers.greeting}`;
  return appendAgentStyleNotes(base, settings);
}
