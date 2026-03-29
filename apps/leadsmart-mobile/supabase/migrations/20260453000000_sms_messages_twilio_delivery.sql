-- Twilio delivery tracking on CRM SMS rows (status callbacks).

alter table if exists public.sms_messages
  add column if not exists external_message_id text null,
  add column if not exists twilio_status text null,
  add column if not exists delivery_error_code text null,
  add column if not exists delivery_error_message text null;

create index if not exists idx_sms_messages_external_message_id
  on public.sms_messages(external_message_id)
  where external_message_id is not null;
