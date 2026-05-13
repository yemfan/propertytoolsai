-- Scheduled social posts — Phase 2C of Generate Leads.
--
-- Agent drafts a Quick Post in the wizard, picks "Schedule for later"
-- with a target datetime, and a row lands here. A Vercel cron job
-- (every 5 min) picks up rows where status='scheduled' and
-- scheduled_for <= now(), publishes them via the same
-- lib/leads-gen/publish.ts helper the sync /publish endpoint uses,
-- and stamps the outcome.
--
-- Why a separate table vs lead_posts:
--   - lead_posts is a record of what WAS published (one row per
--     successful Meta call). Scheduled posts haven't published yet
--     and may never publish (cancel / fail). Keeping them in their
--     own table avoids polluting the published-history view with
--     pending rows.
--   - On successful publish, the cron writes a lead_posts row in
--     addition to updating the scheduled_posts row's status. The
--     two stay linked via published_lead_post_id.

create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents (id) on delete cascade,
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,

  -- 'facebook' = Page feed; 'instagram' = IG Business via same connection
  platform text not null check (platform in ('facebook', 'instagram')),

  -- The draft payload — the cron uses these to call publish() exactly
  -- like the sync path would.
  caption text not null,
  hashtags text[] not null default array[]::text[],
  media_library_id uuid references public.media_library (id) on delete set null,

  -- Attribution context (same shape as lead_posts).
  trigger_kind text,
  subject_kind text,
  subject_ref_id text,

  -- When the cron should publish this. UTC. Cron compares
  --   scheduled_for <= now()
  -- and atomically claims due rows by setting status='posting'
  -- (see api/cron/publish-scheduled).
  scheduled_for timestamptz not null,

  -- Lifecycle:
  --   scheduled → posting → posted     (happy path)
  --   scheduled → posting → failed     (Meta-side rejection after all retries)
  --   scheduled → cancelled            (agent clicked Cancel)
  status text not null default 'scheduled'
    check (status in ('scheduled', 'posting', 'posted', 'failed', 'cancelled')),

  -- Retry tracking. The cron retries failed publish attempts with
  -- exponential backoff (5min / 30min / 2h) up to attempt_count=3,
  -- then permanently marks failed.
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  last_error text,

  -- Linking — populated on successful publish so the management UI
  -- can deep-link "this scheduled post → the actual post on Meta".
  published_lead_post_id uuid references public.lead_posts (id) on delete set null,
  published_at timestamptz,

  -- The user who scheduled it. Useful for audit + multi-user team
  -- environments where the scheduling agent may differ from the
  -- account that owns the connection (Phase 3 team-account land).
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cron hot path: claim due rows. Index on (status, scheduled_for) so
-- the `where status='scheduled' and scheduled_for <= now()` query
-- doesn't full-scan.
create index if not exists scheduled_posts_due_idx
  on public.scheduled_posts (status, scheduled_for)
  where status = 'scheduled';

-- Retry hot path: same idea for posts in retry state.
create index if not exists scheduled_posts_retry_idx
  on public.scheduled_posts (status, next_attempt_at)
  where status = 'posting' and next_attempt_at is not null;

-- Management UI: list this agent's scheduled posts, newest first.
create index if not exists scheduled_posts_agent_idx
  on public.scheduled_posts (agent_id, scheduled_for desc);

comment on table public.scheduled_posts is
  'Future-dated Quick Posts queued via the wizard. Vercel cron picks due rows + publishes via shared lib/leads-gen/publish helper.';
