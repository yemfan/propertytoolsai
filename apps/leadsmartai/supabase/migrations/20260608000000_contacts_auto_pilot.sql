-- Per-contact Auto Pilot flag.
--
-- When true, the dashboard "AI Guide" panel auto-sends drafted SMS
-- without a click-to-confirm gate, AND the Twilio inbound webhook
-- generates + sends an AI reply automatically (instead of stopping
-- automation and notifying the agent).
--
-- Default false so existing contacts keep their current behavior.
-- Indexed because the webhook reads it on every inbound SMS.

alter table public.contacts
  add column if not exists auto_pilot boolean not null default false;

create index if not exists idx_contacts_auto_pilot
  on public.contacts(auto_pilot)
  where auto_pilot = true;

comment on column public.contacts.auto_pilot is
  'When true, AI Guide auto-sends outbound SMS and the Twilio webhook auto-replies to inbound. Per-contact opt-in driven by the agent.';
