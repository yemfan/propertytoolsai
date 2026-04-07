import {
  notifyAgentOfHotLead,
  type NotifyAgentOfHotLeadParams,
} from "@/lib/ai-sms/notifications";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { escalateHotInboundVoiceCall } from "./hot-call-escalation";
import { resolveEffectiveAgentId } from "./hot-call-task";
import {
  classifyCallIntentFromTranscript,
  detectHotLeadFromCall,
} from "./heuristics";
import {
  createLeadIfMissing,
  ensureLeadAgent,
  findLeadByPhone,
  getAgentDisplayName,
  normalizeTwilioFromToUsPhone,
  resolveVoiceAgentId,
} from "./lead-resolution";
import type { SmsLeadSnapshot } from "./lead-resolution";
import type { LeadCallStatus } from "./types";
import {
  createInitialVoiceSessionState,
  parseVoiceSession,
  resolveVoiceSessionLanguage,
  type VoiceSessionLanguage,
} from "./voice-language";
import { voiceFlowKeyFromIntent } from "./voice-scripts";
import { getAgentAiSettings } from "@/lib/agent-ai/settings";
import { analyzeVoiceTranscript } from "./voice-transcript-analysis";
import { voiceHooks } from "./hooks";

function toE164Us(input: string): string | null {
  const d = input.replace(/\D/g, "");
  const last10 = d.slice(-10);
  if (last10.length !== 10) return null;
  return `+1${last10}`;
}

export function normalizeTwilioStatusToInternal(raw: string | null): LeadCallStatus {
  const s = (raw || "").toLowerCase();
  if (s === "ringing" || s === "queued") return "ringing";
  if (s === "in-progress" || s === "answered") return "in_progress";
  if (s === "completed") return "completed";
  if (s === "busy") return "failed";
  if (s === "failed" || s === "canceled") return "failed";
  if (s === "no-answer") return "no_answer";
  return "unknown";
}

export { classifyCallIntentFromTranscript, detectHotLeadFromCall } from "./heuristics";

export async function findLeadByPhoneDisplay(phoneDisplay: string): Promise<SmsLeadSnapshot | null> {
  return findLeadByPhone(phoneDisplay);
}

export async function createLeadIfMissingForInbound(fromE164: string): Promise<SmsLeadSnapshot> {
  const display = normalizeTwilioFromToUsPhone(fromE164);
  if (!display) {
    throw new Error("invalid_caller_number");
  }
  const existing = await findLeadByPhone(display);
  if (existing?.leadId) {
    return existing;
  }
  return createLeadIfMissing(display);
}

export async function createLeadCall(params: {
  twilioCallSid: string;
  twilioAccountSid: string | null;
  fromPhone: string;
  toPhone: string;
  leadId: string | null;
  agentId: string | null;
  status?: LeadCallStatus;
}) {
  const now = new Date().toISOString();
  const row = {
    twilio_call_sid: params.twilioCallSid,
    twilio_account_sid: params.twilioAccountSid,
    direction: "inbound",
    from_phone: params.fromPhone,
    to_phone: params.toPhone,
    lead_id: params.leadId,
    agent_id: params.agentId,
    status: params.status ?? "ringing",
    started_at: now,
    updated_at: now,
    metadata: {
      voice_session: createInitialVoiceSessionState(),
    } as Record<string, unknown>,
  };

  const { data, error } = await supabaseAdmin
    .from("lead_calls")
    .upsert(row as never, { onConflict: "twilio_call_sid" })
    .select("id")
    .single();

  if (error) throw error;
  return { id: String((data as { id: unknown }).id) };
}

export async function getCallByTwilioSid(twilioCallSid: string) {
  const { data, error } = await supabaseAdmin
    .from("lead_calls")
    .select("id,lead_id,agent_id")
    .eq("twilio_call_sid", twilioCallSid)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const r = data as { id: unknown; lead_id: unknown; agent_id: unknown };
  return {
    id: String(r.id),
    lead_id: r.lead_id != null ? String(r.lead_id) : null,
    agent_id: r.agent_id != null ? String(r.agent_id) : null,
  };
}

export async function updateLeadCallStatus(params: {
  twilioCallSid: string;
  status?: LeadCallStatus | string | null;
  durationSeconds?: number | null;
  recordingUrl?: string | null;
  endedAt?: boolean;
}) {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (params.status != null) patch.status = params.status;
  if (params.durationSeconds != null && Number.isFinite(params.durationSeconds)) {
    patch.duration_seconds = params.durationSeconds;
  }
  if (params.recordingUrl) patch.recording_url = params.recordingUrl;
  if (params.endedAt) {
    patch.ended_at = new Date().toISOString();
  }

  const { error } = await supabaseAdmin
    .from("lead_calls")
    .update(patch as never)
    .eq("twilio_call_sid", params.twilioCallSid);

  if (error) throw error;

  // Update last_contacted_at on the lead.
  try {
    const { data: call } = await supabaseAdmin
      .from("lead_calls")
      .select("lead_id")
      .eq("twilio_call_sid", params.twilioCallSid)
      .maybeSingle();
    if (call?.lead_id) {
      await supabaseAdmin
        .from("leads")
        .update({ last_contacted_at: new Date().toISOString() } as Record<string, unknown>)
        .eq("id", call.lead_id);
    }
  } catch {
    // best-effort
  }
}

export async function appendLeadCallEvent(params: {
  leadCallId: string;
  eventType: string;
  metadataJson?: Record<string, unknown>;
}) {
  await supabaseAdmin.from("lead_call_events").insert({
    lead_call_id: params.leadCallId,
    event_type: params.eventType,
    metadata_json: params.metadataJson ?? {},
  } as never);
}

async function insertLeadActivityEvent(params: {
  leadId: string;
  agentId: string | null;
  eventType: string;
  metadata: Record<string, unknown>;
}) {
  const agentId = await resolveEffectiveAgentId(params.leadId, params.agentId);
  await supabaseAdmin.from("lead_events").insert({
    lead_id: params.leadId as never,
    agent_id: agentId as never,
    event_type: params.eventType,
    metadata: params.metadata,
  } as never);
}

async function appendLeadConversationVoiceSummary(params: {
  leadId: string;
  agentId: string | null;
  summary: string;
}) {
  if (!params.agentId) return;
  const { data: row } = await supabaseAdmin
    .from("lead_conversations")
    .select("id,messages")
    .eq("lead_id", params.leadId as never)
    .maybeSingle();

  const prev = row && Array.isArray((row as { messages?: unknown }).messages)
    ? ([...(row as { messages: unknown[] }).messages] as Record<string, unknown>[])
    : [];
  const msg = {
    role: "assistant",
    content: `Phone call summary: ${params.summary}`,
    created_at: new Date().toISOString(),
    source: "voice",
  };
  const next = [...prev, msg];
  await supabaseAdmin.from("lead_conversations").upsert(
    {
      lead_id: params.leadId as never,
      agent_id: params.agentId as never,
      messages: next as never,
      preferences: {} as never,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "lead_id" }
  );
}

export type ProcessGatheredSpeechResult =
  | { ok: false }
  | { ok: true; leadId: string | null; agentId: string | null; voiceLanguage: VoiceSessionLanguage };

export async function processGatheredSpeech(params: {
  twilioCallSid: string;
  speechResult: string;
  callStatus: string | null;
}): Promise<ProcessGatheredSpeechResult> {
  const row = await getCallByTwilioSid(params.twilioCallSid);
  if (!row) return { ok: false };

  const { data: existingCall } = await supabaseAdmin
    .from("lead_calls")
    .select("metadata")
    .eq("twilio_call_sid", params.twilioCallSid)
    .maybeSingle();

  const prevMetaEarly =
    existingCall && typeof (existingCall as { metadata?: unknown }).metadata === "object"
      ? ({ ...((existingCall as { metadata: Record<string, unknown> }).metadata ?? {}) } as Record<
          string,
          unknown
        >)
      : {};

  const voiceSession = parseVoiceSession(prevMetaEarly.voice_session);
  const langResolved = resolveVoiceSessionLanguage(params.speechResult, voiceSession);

  const agentAiSettings = await getAgentAiSettings(row.agent_id);
  const analysis = await analyzeVoiceTranscript(params.speechResult, {
    outputLanguage: langResolved.language,
    agentAiSettings,
  });
  const intent = analysis.inferredIntent;
  const hot = analysis.hotLead;
  const needsHuman = analysis.needsHuman;

  const prevMeta = prevMetaEarly;

  const qualificationFlow = voiceFlowKeyFromIntent(analysis.inferredIntent);

  const voiceAnalysisMeta = {
    inferred_intent: analysis.inferredIntent,
    intent_role: analysis.intentRole,
    qualification_flow: qualificationFlow,
    language: langResolved.language,
    language_detection: langResolved.method,
    source: analysis.source,
    model: analysis.model,
    reasoning: analysis.reasons,
    analyzed_at: new Date().toISOString(),
  };

  await supabaseAdmin
    .from("lead_calls")
    .update({
      transcript: params.speechResult,
      summary: analysis.summary,
      inferred_intent: intent,
      hot_lead: hot,
      needs_human: needsHuman,
      status: "in_progress",
      updated_at: new Date().toISOString(),
      metadata: {
        ...prevMeta,
        voice_session: langResolved.nextSession,
        voice_analysis: voiceAnalysisMeta,
      } as never,
    } as never)
    .eq("twilio_call_sid", params.twilioCallSid);

  await appendLeadCallEvent({
    leadCallId: row.id,
    eventType: "speech_analyzed",
    metadataJson: {
      inferred_intent: intent,
      intent_role: analysis.intentRole,
      qualification_flow: qualificationFlow,
      language: langResolved.language,
      language_detection: langResolved.method,
      hot_lead: hot,
      needs_human: needsHuman,
      reasoning: {
        intent: analysis.reasons.intent ?? null,
        hot_lead: analysis.reasons.hot_lead ?? null,
        needs_human: analysis.reasons.needs_human ?? null,
      },
      source: analysis.source,
      model: analysis.model,
    },
  });

  const activityMetadata = {
    twilio_call_sid: params.twilioCallSid,
    transcript_preview: params.speechResult.slice(0, 400),
    inferred_intent: intent,
    intent_role: analysis.intentRole,
    qualification_flow: qualificationFlow,
    language: langResolved.language,
    language_detection: langResolved.method,
    hot_lead: hot,
    needs_human: needsHuman,
    reasoning: {
      intent: analysis.reasons.intent ?? null,
      hot_lead: analysis.reasons.hot_lead ?? null,
      needs_human: analysis.reasons.needs_human ?? null,
    },
    summary: analysis.summary,
    ai_source: analysis.source,
    model: analysis.model ?? null,
  };

  if (row.lead_id) {
    await insertLeadActivityEvent({
      leadId: row.lead_id,
      agentId: row.agent_id,
      eventType: "voice_call_speech",
      metadata: activityMetadata,
    });
    await appendLeadConversationVoiceSummary({
      leadId: row.lead_id,
      agentId: row.agent_id,
      summary: analysis.summary,
    });
  }

  if (row.lead_id && (hot || needsHuman)) {
    await escalateHotInboundVoiceCall({
      leadId: row.lead_id,
      callAgentId: row.agent_id,
      twilioCallSid: params.twilioCallSid,
      hot,
      needsHuman,
      summary: analysis.summary,
      speechResult: params.speechResult,
      inferredIntent: intent,
      intentRole: analysis.intentRole,
    });
  }

  if (row.lead_id) {
    await voiceHooks.onCallProcessed({
      callId: row.id,
      twilioCallSid: params.twilioCallSid,
      leadId: row.lead_id,
      agentId: row.agent_id,
      intent,
      hotLead: hot,
      needsHuman,
      intentRole: analysis.intentRole,
      summary: analysis.summary,
      analysisSource: analysis.source,
    });
  }

  return {
    ok: true as const,
    leadId: row.lead_id,
    agentId: row.agent_id,
    voiceLanguage: langResolved.language,
  };
}

export async function notifyAgentOfHotCall(
  params: Omit<NotifyAgentOfHotLeadParams, "source">
) {
  return notifyAgentOfHotLead({
    ...params,
    source: "ai_voice",
  });
}

export async function handleInboundWebhookStart(params: {
  twilioCallSid: string;
  twilioAccountSid: string | null;
  fromRaw: string;
  toRaw: string;
  callStatus: string | null;
}) {
  const fromPhone = toE164Us(params.fromRaw) || params.fromRaw;
  const toPhone = toE164Us(params.toRaw) || params.toRaw;
  const agentId = await resolveVoiceAgentId(toPhone);

  const display = normalizeTwilioFromToUsPhone(fromPhone);
  let leadId: string | null = null;
  let snapshot: SmsLeadSnapshot | null = null;

  if (display) {
    try {
      snapshot = await createLeadIfMissingForInbound(fromPhone);
      leadId = snapshot.leadId;
      if (leadId && agentId) await ensureLeadAgent(leadId, agentId);
    } catch {
      leadId = null;
    }
  }

  const { id: callId } = await createLeadCall({
    twilioCallSid: params.twilioCallSid,
    twilioAccountSid: params.twilioAccountSid,
    fromPhone,
    toPhone,
    leadId,
    agentId,
    status: normalizeTwilioStatusToInternal(params.callStatus) as LeadCallStatus,
  });

  await appendLeadCallEvent({
    leadCallId: callId,
    eventType: "inbound_start",
    metadataJson: { callStatus: params.callStatus, fromPhone, toPhone },
  });

  if (leadId) {
    await insertLeadActivityEvent({
      leadId,
      agentId,
      eventType: "voice_call_inbound",
      metadata: { twilio_call_sid: params.twilioCallSid, from_phone: fromPhone },
    });
  }

  const branding = agentId ? await getAgentDisplayName(agentId) : null;

  return {
    callId,
    leadId,
    agentId,
    brandingName: branding,
  };
}

export { toE164Us };
