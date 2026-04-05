import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createSmsLeadIfMissing,
  findLeadByPhone,
  leadRowToSnapshot,
  normalizeTwilioFromToUsPhone,
} from "@/lib/ai-sms/lead-resolution";
import type { SmsLeadSnapshot } from "@/lib/ai-sms/types";

export type { SmsLeadSnapshot };

/** Re-export CRM phone lookup (normalized display format). */
export { findLeadByPhone };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve a UUID auth_user_id to the agents.id bigint string. */
async function authUserIdToAgentId(authUserId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("agents")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  const id = (data as { id?: unknown } | null)?.id;
  return id != null ? String(id) : null;
}

/** Map inbound Twilio DID (E.164) → agent id (bigint string). */
export async function resolveVoiceAgentId(toE164: string): Promise<string | null> {
  const raw = process.env.VOICE_INBOUND_AGENT_MAP?.trim();
  if (raw) {
    try {
      const map = JSON.parse(raw) as Record<string, string>;
      const v = map[toE164.trim()];
      if (v && /^\d+$/.test(String(v))) return String(v);
    } catch {
      // ignore
    }
  }
  // Accepts a UUID (auth_user_id) — consistent with CONSUMER_ASSIGNED_AGENT_AUTH_ID_DEFAULT.
  const def = process.env.LEADSMART_VOICE_DEFAULT_AGENT_ID?.trim();
  if (def) {
    if (UUID_RE.test(def)) return authUserIdToAgentId(def);
    if (/^\d+$/.test(def)) return def; // legacy bigint fallback
  }
  return null;
}

export async function createLeadIfMissing(phoneDisplay: string): Promise<SmsLeadSnapshot> {
  return createSmsLeadIfMissing({
    phoneDisplay,
    source: "phone_inbound",
    intent: "unknown",
  });
}

export async function findOrCreateLeadForPhone(phoneDisplay: string): Promise<{
  snapshot: SmsLeadSnapshot;
  created: boolean;
}> {
  const existing = await findLeadByPhone(phoneDisplay);
  if (existing?.leadId) {
    return { snapshot: existing, created: false };
  }
  const snap = await createLeadIfMissing(phoneDisplay);
  return { snapshot: snap, created: true };
}

/** Assign agent to lead when lead has no agent yet. */
export async function ensureLeadAgent(leadId: string, agentId: string | null) {
  if (!agentId) return;
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("agent_id")
    .eq("id", leadId as never)
    .maybeSingle();
  const cur = lead && (lead as { agent_id?: unknown }).agent_id;
  if (cur != null && cur !== "") return;
  await supabaseAdmin
    .from("leads")
    .update({ agent_id: agentId as never } as never)
    .eq("id", leadId as never);
}

export async function getAgentDisplayName(agentId: string): Promise<string | null> {
  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("auth_user_id")
    .eq("id", agentId as never)
    .maybeSingle();
  const uid = agent && (agent as { auth_user_id?: string | null }).auth_user_id;
  if (!uid) return null;
  const { data: prof } = await supabaseAdmin
    .from("user_profiles")
    .select("full_name")
    .eq("user_id", uid)
    .maybeSingle();
  const n = prof && (prof as { full_name?: string | null }).full_name;
  return n?.trim() || null;
}

export { leadRowToSnapshot, normalizeTwilioFromToUsPhone };
