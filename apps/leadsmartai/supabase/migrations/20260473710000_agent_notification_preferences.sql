-- Per-agent push preferences + delivery tracking for agent_inbox_notifications.

create table if not exists public.agent_notification_preferences (
  agent_id bigint primary key references public.agents (id) on delete cascade,
  push_hot_lead boolean not null default true,
  push_missed_call boolean not null default true,
  push_reminder boolean not null default true,
  reminder_digest_minutes int not null default 15,
  updated_at timestamptz not null default now(),
  constraint agent_notification_preferences_digest_chk
    check (reminder_digest_minutes >= 5 and reminder_digest_minutes <= 120)
);

comment on table public.agent_notification_preferences is
  'LeadSmart mobile: per-category push toggles and reminder batching window.';

alter table public.agent_inbox_notifications
  add column if not exists push_sent_at timestamptz;

comment on column public.agent_inbox_notifications.push_sent_at is
  'When push was sent (or suppressed for disabled prefs). Null = pending reminder digest.';

alter table public.agent_notification_preferences enable row level security;

create policy agent_notification_preferences_select_own
  on public.agent_notification_preferences
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.agents a
      where a.id = agent_notification_preferences.agent_id
        and a.auth_user_id = auth.uid()
    )
  );

create policy agent_notification_preferences_insert_own
  on public.agent_notification_preferences
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.agents a
      where a.id = agent_notification_preferences.agent_id
        and a.auth_user_id = auth.uid()
    )
  );

create policy agent_notification_preferences_update_own
  on public.agent_notification_preferences
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.agents a
      where a.id = agent_notification_preferences.agent_id
        and a.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.agents a
      where a.id = agent_notification_preferences.agent_id
        and a.auth_user_id = auth.uid()
    )
  );
