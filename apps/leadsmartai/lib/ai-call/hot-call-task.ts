import { supabaseAdmin } from "@/lib/supabase/admin";
import type { VoiceCallIntent } from "./types";

const MS_HOUR = 60 * 60 * 1000;

export type VoiceHotTaskPriority = "urgent" | "high" | "medium";

export type VoiceHotFollowUpTaskSpec = {
  title: string;
  dueAt: string;
  priority: VoiceHotTaskPriority;
  /** Hint shown in description (e.g. “Callback window: within 1 hour”). */
  callbackHint: string;
};

/**
 * Prefer `lead_calls.agent_id`; fall back to `leads.agent_id` when the call row
 * was not stamped yet.
 */
export async function resolveEffectiveAgentId(
  leadId: string,
  callAgentId: string | null
): Promise<string | null> {
  if (callAgentId) return callAgentId;
  const { data } = await supabaseAdmin
    .from("leads")
    .select("agent_id")
    .eq("id", leadId as never)
    .maybeSingle();
  const a = data && (data as { agent_id?: unknown }).agent_id;
  return a != null && a !== "" ? String(a) : null;
}

export async function hasOpenVoiceFollowUpForCall(
  leadId: string,
  twilioCallSid: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("lead_tasks")
    .select("id")
    .eq("lead_id", leadId as never)
    .eq("status", "open")
    .eq("task_type", "voice_follow_up")
    .contains("metadata_json", { twilio_call_sid: twilioCallSid } as Record<string, unknown>)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.id);
}

/**
 * Intent-aware titles and due times for lead_tasks (mobile + dashboard).
 * Examples: callback within 1 hour, showing follow-up, seller consultation.
 */
export function buildVoiceHotFollowUpTaskSpec(params: {
  needsHuman: boolean;
  hotLead: boolean;
  inferredIntent: VoiceCallIntent;
}): VoiceHotFollowUpTaskSpec {
  const { needsHuman, hotLead, inferredIntent } = params;

  if (needsHuman) {
    const dueAt = new Date(Date.now() + MS_HOUR).toISOString();
    return {
      title: "Call back within 1 hour — caller needs an agent",
      dueAt,
      priority: "urgent",
      callbackHint: "Callback window: within 1 hour (needs_human escalation).",
    };
  }

  switch (inferredIntent) {
    case "appointment":
      return {
        title: "Schedule showing / appointment follow-up — voice call",
        dueAt: new Date(Date.now() + 2 * MS_HOUR).toISOString(),
        priority: "high",
        callbackHint: "Follow up to schedule or confirm appointment from inbound call.",
      };
    case "buyer_listing_inquiry":
      return {
        title: "Buyer follow-up — listings / tours (voice call)",
        dueAt: new Date(Date.now() + (hotLead ? MS_HOUR : 2 * MS_HOUR)).toISOString(),
        priority: "high",
        callbackHint: hotLead
          ? "Hot buyer — callback within about 1 hour when possible."
          : "Follow up on buyer interest from call.",
      };
    case "buyer_financing":
      return {
        title: "Buyer financing follow-up — voice call",
        dueAt: new Date(Date.now() + 2 * MS_HOUR).toISOString(),
        priority: "high",
        callbackHint: "Follow up on mortgage / financing questions from call.",
      };
    case "seller_list_home":
    case "seller_home_value":
      return {
        title: "Seller consultation follow-up — voice call",
        dueAt: new Date(Date.now() + 4 * MS_HOUR).toISOString(),
        priority: "high",
        callbackHint: "Schedule listing or valuation consultation from inbound call.",
      };
    case "support":
      return {
        title: "Support / account follow-up — voice call",
        dueAt: new Date(Date.now() + 4 * MS_HOUR).toISOString(),
        priority: "medium",
        callbackHint: "Resolve account or app support request from call.",
      };
    default:
      return {
        title: "Hot lead callback — voice call",
        dueAt: new Date(Date.now() + MS_HOUR).toISOString(),
        priority: "high",
        callbackHint: "Hot inbound call — follow up while interest is high.",
      };
  }
}

export type CreateVoiceHotFollowUpTaskParams = {
  leadId: string;
  callAgentId: string | null;
  twilioCallSid: string;
  needsHuman: boolean;
  hotLead: boolean;
  summary: string;
  transcriptPreview: string;
  inferredIntent: VoiceCallIntent;
  intentRole: string;
};

/**
 * Creates one open `lead_tasks` row per call (deduped by `twilio_call_sid` in metadata).
 * Emits `lead_events` row `voice_hot_escalation_task_created` for the lead activity timeline.
 */
export async function createVoiceHotFollowUpTask(
  params: CreateVoiceHotFollowUpTaskParams
): Promise<{ created: boolean; taskId?: string }> {
  const agentId = await resolveEffectiveAgentId(params.leadId, params.callAgentId);
  if (!agentId) return { created: false };

  if (await hasOpenVoiceFollowUpForCall(params.leadId, params.twilioCallSid)) {
    return { created: false };
  }

  const spec = buildVoiceHotFollowUpTaskSpec({
    needsHuman: params.needsHuman,
    hotLead: params.hotLead,
    inferredIntent: params.inferredIntent,
  });

  const description = [
    spec.callbackHint,
    params.summary.trim(),
    params.transcriptPreview.trim()
      ? `Caller said: ${params.transcriptPreview.trim().slice(0, 500)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const { data: inserted, error } = await supabaseAdmin
    .from("lead_tasks")
    .insert({
      lead_id: params.leadId as never,
      assigned_agent_id: agentId as never,
      title: spec.title,
      description,
      status: "open",
      priority: spec.priority,
      task_type: "voice_follow_up",
      created_by: "system",
      due_at: spec.dueAt,
      metadata_json: {
        source: "ai_voice",
        twilio_call_sid: params.twilioCallSid,
        reason: params.needsHuman ? "needs_human" : "voice_hot_lead",
        inferred_intent: params.inferredIntent,
        intent_role: params.intentRole,
        escalation: "hot_voice_inbound",
      },
    } as never)
    .select("id")
    .single();

  if (error) throw error;

  const taskId = inserted && (inserted as { id?: unknown }).id != null
    ? String((inserted as { id: unknown }).id)
    : undefined;

  try {
    await supabaseAdmin.from("lead_events").insert({
      lead_id: params.leadId as never,
      agent_id: agentId as never,
      event_type: "voice_hot_escalation_task_created",
      metadata: {
        twilio_call_sid: params.twilioCallSid,
        task_id: taskId ?? null,
        task_title: spec.title,
        due_at: spec.dueAt,
        priority: spec.priority,
        inferred_intent: params.inferredIntent,
        source: "ai_voice",
      },
    } as Record<string, unknown>);
  } catch {
    // ignore
  }

  return { created: true, taskId };
}
