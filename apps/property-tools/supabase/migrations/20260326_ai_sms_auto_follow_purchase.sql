-- AI SMS auto-follow system for purchased leads

create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads(id) on delete cascade,
  agent_id uuid,
  message text not null,
  direction text not null,
  created_at timestamptz not null default now(),
  constraint sms_messages_direction_check check (direction in ('inbound','outbound'))
);

create index if not exists idx_sms_messages_lead_created
  on public.sms_messages(lead_id, created_at desc);
create index if not exists idx_sms_messages_agent_created
  on public.sms_messages(agent_id, created_at desc);

alter table if exists public.leads
  add column if not exists sms_ai_enabled boolean not null default true,
  add column if not exists sms_agent_takeover boolean not null default false,
  add column if not exists sms_followup_stage int not null default 0,
  add column if not exists sms_last_outbound_at timestamptz,
  add column if not exists sms_last_inbound_at timestamptz,
  add column if not exists sms_opted_out_at timestamptz;

create index if not exists idx_leads_sms_ai_enabled on public.leads(sms_ai_enabled);
create index if not exists idx_leads_sms_agent_takeover on public.leads(sms_agent_takeover);
create index if not exists idx_leads_sms_followup_stage on public.leads(sms_followup_stage);
create index if not exists idx_leads_sms_last_outbound_at on public.leads(sms_last_outbound_at desc);
