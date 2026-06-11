import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildVoicePlaybook, VOICE_GUARDRAILS, getAssistant } from "@helm/pack-real-estate";

/**
 * Real-estate behaviour block injected into the voice receptionist's
 * per-call system prompt (as `ReceptionistContext.extraNotes`).
 *
 * Driven by the agent's AI-team configuration: the skills enabled on
 * their AI Receptionist (Manage AI Team page) select which
 * qualification/escalation lines the live phone agent follows. Falls
 * back to the roster defaults when no row exists, and always includes
 * the compliance guardrails.
 *
 * Sits on the inbound-call hot path — one indexed read, and any
 * failure degrades to the roster default rather than failing the call.
 */
export async function buildReceptionistVoiceNotes(agentId: string): Promise<string> {
  let skills: readonly string[] = getAssistant("receptionist").skills;
  try {
    const { data } = await supabaseAdmin
      .from("ai_assistants")
      .select("enabled_skills")
      .eq("agent_id", agentId)
      .eq("type", "receptionist")
      .maybeSingle();
    const enabled = (data as { enabled_skills?: unknown } | null)?.enabled_skills;
    if (Array.isArray(enabled)) {
      skills = enabled.filter((s): s is string => typeof s === "string");
    }
  } catch (e) {
    console.warn("[realtorboss] voice persona lookup failed, using roster defaults:", e);
  }

  const playbook = buildVoicePlaybook(skills);
  return [playbook, `## Compliance\n${VOICE_GUARDRAILS}`].filter(Boolean).join("\n\n");
}
