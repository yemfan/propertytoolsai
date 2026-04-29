-- Smart Lead Management: rating + follow-up cadence + communications log

-- 1) Leads table fields
alter table if exists public.leads
  add column if not exists rating text not null default 'warm',
  add column if not exists contact_frequency text not null default 'weekly',
  add column if not exists contact_method text not null default 'email',
  add column if not exists last_contacted_at timestamptz,
  add column if not exists next_contact_at timestamptz not null default (now() + interval '7 days');

create index if not exists idx_leads_next_contact_at on public.leads(next_contact_at);
create index if not exists idx_leads_rating on public.leads(rating);

-- 2) Communications log
create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  agent_id uuid,
  type text not null, -- email | sms
  content text not null,
  status text not null, -- sent | failed
  created_at timestamptz not null default now()
);

create index if not exists idx_communications_lead_id_created_at
  on public.communications(lead_id, created_at desc);
create index if not exists idx_communications_agent_id_created_at
  on public.communications(agent_id, created_at desc);

