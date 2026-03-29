export type ReengagementChannel = "sms" | "email";

export type ReengagementTriggerType = "cold_lead" | "no_activity" | "anniversary" | "custom";

export type ReengagementLead = {
  id: string;
  agentId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  propertyAddress: string | null;
  lastContactedAt: string | null;
  lastActivityAt: string | null;
  contactOptOutSms: boolean;
  contactOptOutEmail: boolean;
  smsOptIn?: boolean;
  preferredContactChannel: string | null;
  mergedIntoLeadId: string | null;
  /** From `leads.prediction_score` — used to prioritize outreach within a campaign run. */
  predictionScore: number | null;
  predictionLabel: string | null;
};

export type ReengagementMessageRow = {
  id: string;
  campaign_id: string;
  step_number: number;
  delay_days: number;
  step_type: string;
  template: string | null;
};

export type ReengagementCampaignRow = {
  id: string;
  name: string | null;
  agent_id: string;
  status: string;
  channel: ReengagementChannel;
  trigger_type: ReengagementTriggerType;
  days_inactive: number;
  max_per_run: number;
  use_ai: boolean;
};

export type ReplyIntent = "hot" | "opt_out" | "neutral";
