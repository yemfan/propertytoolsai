/** Twilio + internal CRM status for lead_calls.status */
export type LeadCallStatus =
  | "ringing"
  | "in_progress"
  | "completed"
  | "failed"
  | "no_answer"
  | "unknown";

export type LeadCallDirection = "inbound" | "outbound";

/**
 * CRM intent for `lead_calls.inferred_intent` (OpenAI + heuristics).
 * Real-estate–specific routing labels.
 */
export type VoiceCallIntent =
  | "buyer_listing_inquiry"
  | "buyer_financing"
  | "seller_home_value"
  | "seller_list_home"
  | "appointment"
  | "support"
  | "unknown";

/** @deprecated Use {@link VoiceCallIntent} */
export type InferredCallIntent = VoiceCallIntent;

/** High-level bucket for analytics / UI (derived from {@link VoiceCallIntent}). */
export type VoiceIntentRole = "buyer" | "seller" | "appointment" | "support" | "general" | "unknown";

export type VoiceAnalysisReasons = {
  intent?: string;
  hot_lead?: string;
  needs_human?: string;
};

export type VoiceAnalysisResult = {
  summary: string;
  inferredIntent: VoiceCallIntent;
  intentRole: VoiceIntentRole;
  hotLead: boolean;
  needsHuman: boolean;
  reasons: VoiceAnalysisReasons;
  source: "openai" | "heuristic";
  model?: string;
};

export type LeadCallRow = {
  id: string;
  contact_id: string | null;
  twilio_call_sid: string;
  from_phone: string;
  to_phone: string;
  direction: LeadCallDirection;
  status: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  summary: string | null;
  inferred_intent: string | null;
  hot_lead: boolean;
  needs_human: boolean;
  recording_url: string | null;
  agent_id: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadCallEventRow = {
  id: string;
  lead_call_id: string;
  event_type: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

export type VoiceWebhookContext = {
  callId: string;
  twilioCallSid: string;
  leadId: string | null;
  agentId: string | null;
  fromPhone: string;
  toPhone: string;
};
