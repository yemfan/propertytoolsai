import type { PostcardTemplateKey } from "./templates";

export type PostcardSendRow = {
  id: string;
  agent_id: string;
  contact_id: string | null;
  template_key: PostcardTemplateKey;
  slug: string;
  recipient_name: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  personal_message: string | null;
  channels: string[];
  email_sent_at: string | null;
  sms_sent_at: string | null;
  wechat_sent_at: string | null;
  email_error: string | null;
  sms_error: string | null;
  wechat_error: string | null;
  opened_at: string | null;
  open_count: number;
  created_at: string;
  updated_at: string;
};

/** Public viewer payload — only safe-to-expose fields. */
export type PublicPostcardView = {
  templateKey: PostcardTemplateKey;
  recipientName: string;
  personalMessage: string;
  agentName: string | null;
  agentPhotoUrl: string | null;
  brandName: string | null;
  /** Deep-link targets so recipient can reply without typing. */
  agentEmail: string | null;
  agentPhone: string | null;
};
