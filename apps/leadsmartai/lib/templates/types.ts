export type TemplateCategory = "sphere" | "lead_response" | "lifecycle";
export type TemplateChannel = "sms" | "email";
export type TemplateStatus = "autosend" | "review" | "off";
export type TemplateLanguage = "en" | "zh";
export type TemplateSource = "spec" | "spec_expanded" | "invented";

export type TemplateRow = {
  id: string;
  category: TemplateCategory;
  name: string;
  channel: TemplateChannel;
  subject: string | null;
  body: string;
  language: TemplateLanguage;
  variant_of: string | null;
  placeholders: string[];
  trigger_config: Record<string, unknown>;
  notes: string | null;
  default_status: TemplateStatus;
  source: TemplateSource;
  created_at: string;
  updated_at: string;
};

export type TemplateOverrideRow = {
  agent_id: string;
  template_id: string;
  status: TemplateStatus;
  subject_override: string | null;
  body_override: string | null;
  edited: boolean;
  created_at: string;
  updated_at: string;
};

export type Template = {
  id: string;
  category: TemplateCategory;
  name: string;
  channel: TemplateChannel;
  subject: string | null;
  body: string;
  language: TemplateLanguage;
  variantOf: string | null;
  placeholders: string[];
  triggerConfig: Record<string, unknown>;
  notes: string | null;
  defaultStatus: TemplateStatus;
  source: TemplateSource;
};

export type TemplateOverride = {
  templateId: string;
  status: TemplateStatus;
  subjectOverride: string | null;
  bodyOverride: string | null;
  edited: boolean;
};

export type TemplateWithOverride = Template & {
  /** Effective status = override.status ?? defaultStatus. */
  effectiveStatus: TemplateStatus;
  /** Override subject/body — null when the agent hasn't edited. */
  override: TemplateOverride | null;
  /** Effective subject (override or base). */
  effectiveSubject: string | null;
  /** Effective body (override or base). */
  effectiveBody: string;
};
