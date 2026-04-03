-- Unified agent inbox: hot_lead | missed_call | reminder.
-- NOTE: `public.notifications` already exists for legacy smart listing alerts (lead_id / property_id / message).
-- This table is separate so CRM inbox rows do not collide with property ping history.

create table if not exists public.agent_inbox_notifications (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents (id) on delete cascade,
  type text not null,
  priority text not null,
  title text not null,
  body text not null,
  data jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint agent_inbox_notifications_type_chk
    check (type in ('hot_lead', 'missed_call', 'reminder')),
  constraint agent_inbox_notifications_priority_chk
    check (priority in ('high', 'medium', 'low'))
);

comment on table public.agent_inbox_notifications is
  'Agent CRM inbox: hot leads, missed calls, follow-up reminders. Distinct from public.notifications (listing alerts).';

comment on column public.agent_inbox_notifications.type is 'hot_lead | missed_call | reminder';
comment on column public.agent_inbox_notifications.priority is 'high | medium | low';

create index if not exists idx_agent_inbox_notifications_agent_created_at
  on public.agent_inbox_notifications (agent_id, created_at desc);

create index if not exists idx_agent_inbox_notifications_agent_unread
  on public.agent_inbox_notifications (agent_id)
  where read = false;

alter table public.agent_inbox_notifications enable row level security;

create policy agent_inbox_notifications_select_own
  on public.agent_inbox_notifications
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.agents a
      where a.id = agent_inbox_notifications.agent_id
        and a.auth_user_id = auth.uid()
    )
  );

create policy agent_inbox_notifications_insert_own
  on public.agent_inbox_notifications
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.agents a
      where a.id = agent_inbox_notifications.agent_id
        and a.auth_user_id = auth.uid()
    )
  );

create policy agent_inbox_notifications_update_own
  on public.agent_inbox_notifications
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.agents a
      where a.id = agent_inbox_notifications.agent_id
        and a.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.agents a
      where a.id = agent_inbox_notifications.agent_id
        and a.auth_user_id = auth.uid()
    )
  );
