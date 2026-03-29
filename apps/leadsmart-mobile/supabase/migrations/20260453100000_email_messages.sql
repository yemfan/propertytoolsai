-- CRM email thread rows for AI + agent outbound (separate from nurture message_logs).

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads(id) on delete cascade,
  agent_id uuid,
  subject text not null default '',
  message text not null,
  direction text not null,
  created_at timestamptz not null default now(),
  external_message_id text null,
  constraint email_messages_direction_check check (direction in ('inbound', 'outbound'))
);

create index if not exists idx_email_messages_lead_created
  on public.email_messages(lead_id, created_at desc);

create index if not exists idx_email_messages_agent_created
  on public.email_messages(agent_id, created_at desc);
