-- Briefing kinds + per-agent schedule
--
-- Extends the existing `daily_briefings` table (added in
-- 20260319_daily_briefings.sql) so it can store BOTH the morning
-- briefing and the evening summary, instead of just one row per
-- day. Adds `kind` and `headline`, and a unique-per-day-per-kind
-- guard.
--
-- Also adds three columns to `agents` so each agent can configure
-- when their two briefings fire and which timezone they sit in
-- (the cron is one tick that branches off these per-agent
-- preferences). Defaults are chosen to match the user-facing copy:
--   07:00 morning, 18:00 evening, America/Los_Angeles
-- Anyone outside Pacific time updates their tz from settings.

-- ── 1. daily_briefings: kind + headline ─────────────────────────────
alter table public.daily_briefings
  add column if not exists kind text not null default 'morning';

alter table public.daily_briefings
  add column if not exists headline text;

-- Constrain kind to known values. Use add-then-validate so an
-- existing row with NULL or an unknown value doesn't fail the
-- migration on environments that have legacy data. We default to
-- 'morning' above, so backfill is a no-op.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'daily_briefings_kind_check'
  ) then
    execute $sql$
      alter table public.daily_briefings
        add constraint daily_briefings_kind_check
        check (kind in ('morning', 'evening'))
    $sql$;
  end if;
end $$;

-- One briefing per agent per kind per UTC calendar day. Existing
-- code already guards by `gte(start_of_today)` but the unique index
-- gives us a hard rail in case the cron retries.
create unique index if not exists uq_daily_briefings_agent_kind_day
  on public.daily_briefings (agent_id, kind, (date_trunc('day', created_at at time zone 'UTC')));

-- Update the existing agent+created_at index to also index by kind
-- so the dashboard's "latest morning" query is index-only.
create index if not exists idx_daily_briefings_agent_kind_created_at
  on public.daily_briefings (agent_id, kind, created_at desc);

-- ── 2. agents: briefing schedule columns ────────────────────────────
alter table public.agents
  add column if not exists briefing_morning_time text not null default '07:00';

alter table public.agents
  add column if not exists briefing_evening_time text not null default '18:00';

alter table public.agents
  add column if not exists briefing_timezone text not null default 'America/Los_Angeles';

-- Sanity check: HH:MM format. We don't enforce 24h ranges at the
-- DB layer because the UI restricts input to a time picker; this
-- catches typos in raw SQL writes.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'agents_briefing_morning_time_format'
  ) then
    execute $sql$
      alter table public.agents
        add constraint agents_briefing_morning_time_format
        check (briefing_morning_time ~ '^[0-2][0-9]:[0-5][0-9]$')
    $sql$;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'agents_briefing_evening_time_format'
  ) then
    execute $sql$
      alter table public.agents
        add constraint agents_briefing_evening_time_format
        check (briefing_evening_time ~ '^[0-2][0-9]:[0-5][0-9]$')
    $sql$;
  end if;
end $$;

comment on column public.daily_briefings.kind is
  'Briefing type: ''morning'' (start-of-day plan) or ''evening'' (end-of-day summary).';
comment on column public.daily_briefings.headline is
  'AI-generated 1-line hook with optional emoji, shown as the card title.';
comment on column public.agents.briefing_morning_time is
  'HH:MM in agent''s local timezone for the morning briefing.';
comment on column public.agents.briefing_evening_time is
  'HH:MM in agent''s local timezone for the evening summary.';
comment on column public.agents.briefing_timezone is
  'IANA timezone name. Defaults to America/Los_Angeles.';
