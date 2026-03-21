-- Ensure one sms_conversation per lead_id

create unique index if not exists idx_sms_conversations_lead_id_unique
  on public.sms_conversations(lead_id);

