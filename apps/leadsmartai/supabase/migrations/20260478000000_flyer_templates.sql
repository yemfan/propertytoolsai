-- Saved flyers for reuse + agent default template preference.

create table if not exists public.saved_flyers (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents (id) on delete cascade,
  template_key text not null default 'classic',
  property_address text not null,
  flyer_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_saved_flyers_agent
  on public.saved_flyers (agent_id, created_at desc);

alter table public.saved_flyers enable row level security;

create policy saved_flyers_select_own on public.saved_flyers
  for select to authenticated
  using (exists (select 1 from public.agents a where a.id = saved_flyers.agent_id and a.auth_user_id = auth.uid()));

create policy saved_flyers_insert_own on public.saved_flyers
  for insert to authenticated
  with check (exists (select 1 from public.agents a where a.id = saved_flyers.agent_id and a.auth_user_id = auth.uid()));

-- Default template preference on agents table.
alter table public.agents
  add column if not exists default_flyer_template text default 'classic';
