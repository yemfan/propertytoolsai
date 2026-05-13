-- Recurring posts — Phase 2D of Generate Leads.
--
-- Agents define a recurrence pattern (daily / weekly at <day> at
-- <HH:MM> in <tz>) plus a template post. A cron job (every 15 min)
-- materializes the next occurrence into scheduled_posts when it's
-- coming due, and the existing /api/cron/publish-scheduled cron
-- (every 5 min) takes it from there. This separation keeps the
-- materialize step idempotent — even if the materialize cron runs
-- multiple times, it produces at most one scheduled_posts row per
-- (recurrence, occurrence_count).
--
-- Why a 1-hour materialize lookahead:
--   - publish-scheduled cron polls every 5 min, so a row needs to
--     exist a bit before fire time. 1h gives multiple cron ticks
--     of headroom in case the materialize-cron has a bad invocation.
--   - Agents see "next post will go out Mon 9am" up to ~1h in advance
--     in the scheduled-posts list, which is a useful "is everything
--     wired up?" signal.
--
-- Timezone handling: we store HH:MM + IANA tz separately rather
-- than baking the offset into next_occurrence_at, because DST
-- rolls would otherwise drift the time-of-day. Computing the next
-- occurrence reads the recurrence's stored tz + HH:MM and rebuilds
-- the timestamp every time → DST-safe.

create table if not exists public.recurring_post_schedules (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents (id) on delete cascade,
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,

  -- Same platform values as scheduled_posts.
  platform text not null check (platform in ('facebook', 'instagram', 'linkedin')),

  -- Template payload — copied to each materialized scheduled_posts
  -- row. If the agent edits the template later, future occurrences
  -- pick up the change; previously-materialized rows stay as-they-
  -- were (they may already be in 'posting' or 'posted' status).
  caption text not null,
  hashtags text[] not null default array[]::text[],
  media_library_id uuid references public.media_library (id) on delete set null,

  -- Attribution carried over so analytics can group "this campaign's
  -- posts went out via this recurrence" later.
  trigger_kind text,
  subject_kind text,
  subject_ref_id text,

  -- Recurrence pattern. 'daily' = every day at HH:MM. 'weekly' =
  -- every weekly_day_of_week (0=Sun..6=Sat) at HH:MM.
  -- 'monthly' deferred — agents rarely want "every 7th of the month"
  -- in real-estate posting (it's the wrong cadence for engagement).
  cadence text not null check (cadence in ('daily', 'weekly')),
  weekly_day_of_week smallint
    check (weekly_day_of_week is null or weekly_day_of_week between 0 and 6),

  -- Wall-clock time of day in the recurrence's timezone.
  time_of_day_hour smallint not null check (time_of_day_hour between 0 and 23),
  time_of_day_minute smallint not null check (time_of_day_minute between 0 and 59),

  -- IANA timezone. The materialize cron uses this to compute the next
  -- occurrence; storing it explicitly (vs. inferring from the agent's
  -- profile) lets an agent post on multiple Pages each in its own tz
  -- without weird cross-locale behavior.
  timezone text not null default 'UTC',

  -- Lifecycle bounds. starts_at is the earliest time we'll
  -- materialize from (in case an agent schedules in advance for a
  -- campaign that begins next month). ends_at + max_occurrences are
  -- "stop when either is reached" — null in both = unlimited until
  -- the agent cancels.
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  max_occurrences integer,

  -- Counter of how many times we've materialized + the next firing
  -- timestamp (recomputed after each materialize). The cron reads
  -- next_occurrence_at to pick due rows; the index below makes that
  -- a scan-free index hit.
  occurrence_count integer not null default 0,
  next_occurrence_at timestamptz not null,
  last_materialized_at timestamptz,
  -- Loose link to the most recently materialized scheduled_posts row,
  -- useful for "see the last post this recurrence generated" deep
  -- links in the management UI.
  last_materialized_scheduled_post_id uuid references public.scheduled_posts (id) on delete set null,

  -- Lifecycle:
  --   active     → cron materializes occurrences as they come due
  --   paused     → cron skips (agent can resume later)
  --   completed  → reached max_occurrences or ends_at (terminal)
  --   cancelled  → agent killed it (terminal)
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'cancelled')),
  last_error text,

  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cron hot path: find active recurrences whose next firing is due
-- (within the lookahead window).
create index if not exists recurring_post_schedules_due_idx
  on public.recurring_post_schedules (status, next_occurrence_at)
  where status = 'active';

-- Management UI: list this agent's recurrences, active first then
-- by next firing.
create index if not exists recurring_post_schedules_agent_idx
  on public.recurring_post_schedules (agent_id, status, next_occurrence_at);

-- Link scheduled_posts back to its parent recurrence (when one
-- exists). Most scheduled_posts rows are one-off (NULL here);
-- recurrence-materialized rows carry the parent id. Used by the
-- management UI to count "this recurrence has materialized 4
-- scheduled posts so far".
alter table public.scheduled_posts
  add column if not exists recurring_schedule_id uuid
    references public.recurring_post_schedules (id) on delete set null;

create index if not exists scheduled_posts_recurring_idx
  on public.scheduled_posts (recurring_schedule_id)
  where recurring_schedule_id is not null;

comment on table public.recurring_post_schedules is
  'Recurring (daily/weekly) Quick Post templates. A Vercel cron materializes scheduled_posts rows as occurrences come due.';
