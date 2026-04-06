-- Weekly performance digest for agents.
-- Stores computed metrics, coaching insights, and push notification state.

create table if not exists public.performance_digests (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents (id) on delete cascade,
  week_start date not null,
  week_end date not null,
  title text not null,
  body text not null,
  metrics jsonb not null default '{}'::jsonb,
  insights jsonb not null default '[]'::jsonb,
  payload_json jsonb not null default '{}'::jsonb,
  push_sent_at timestamptz,
  created_at timestamptz not null default now(),

  constraint performance_digests_one_per_week
    unique (agent_id, week_start)
);

comment on table public.performance_digests is
  'Weekly agent performance recap: metrics, insights, push state.';

create index if not exists idx_performance_digests_agent_week
  on public.performance_digests (agent_id, week_start desc);

alter table public.performance_digests enable row level security;

create policy performance_digests_select_own
  on public.performance_digests
  for select to authenticated
  using (
    exists (
      select 1 from public.agents a
      where a.id = performance_digests.agent_id
        and a.auth_user_id = auth.uid()
    )
  );
