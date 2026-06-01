/**
 * Per-agent AI voice receptionist configuration (Settings → Voice → AI Voice
 * Receptionist). Persisted in `voice_receptionist_settings`, consumed by the
 * Retell inbound webhook to build the agent's greeting + system prompt.
 */
export type ReceptionistConfig = {
  /** When false, the inbound webhook serves no prompt (receptionist is off). */
  enabled: boolean;
  /** Trade / DBA name the receptionist introduces itself with. */
  businessName: string;
  /** Chinese business name (used when the agent speaks Chinese). */
  businessNameZh: string;
  /** The receptionist's own name, e.g. "Maria" (blank = unnamed). */
  agentName: string;
  /** Custom opening line; blank = auto-generated from the business name. */
  greeting: string;
  /** IANA timezone for "today" / hours phrasing, e.g. "America/New_York". */
  timezone: string;
  /** Free-text the receptionist should know: hours, services, pricing, FAQs. */
  extraNotes: string;
};

/** Raw row shape from `voice_receptionist_settings` (snake_case, nullable). */
export type ReceptionistConfigRow = {
  agent_id: number | string;
  enabled: boolean | null;
  business_name: string | null;
  business_name_zh: string | null;
  agent_name: string | null;
  greeting: string | null;
  timezone: string | null;
  extra_notes: string | null;
  created_at?: string;
  updated_at?: string;
};

export const DEFAULT_RECEPTIONIST_CONFIG: ReceptionistConfig = {
  enabled: true,
  businessName: "",
  businessNameZh: "",
  agentName: "",
  greeting: "",
  timezone: "America/New_York",
  extraNotes: "",
};
