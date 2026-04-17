export type DraftStatus = "pending" | "approved" | "rejected" | "sent" | "failed";
export type DraftChannel = "sms" | "email";

export type MessageDraftRow = {
  id: string;
  agent_id: string;
  contact_id: string;
  template_id: string | null;
  channel: DraftChannel;
  subject: string | null;
  body: string;
  status: DraftStatus;
  trigger_context: Record<string, unknown>;
  edited: boolean;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
  sent_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  scheduled_for: string | null;
};

export type MessageDraft = {
  id: string;
  contactId: string;
  templateId: string | null;
  channel: DraftChannel;
  subject: string | null;
  body: string;
  status: DraftStatus;
  triggerContext: Record<string, unknown>;
  edited: boolean;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  sentAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  scheduledFor: string | null;
};

export type MessageDraftView = MessageDraft & {
  contactFirstName: string;
  contactLastName: string | null;
  contactFullName: string;
  contactInitials: string;
  contactAvatarColor: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  templateName: string | null;
  templateCategory: string | null;
};
