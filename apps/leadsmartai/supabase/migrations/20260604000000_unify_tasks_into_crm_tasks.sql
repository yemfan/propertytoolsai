-- Phase 2c — unify all task tables under public.crm_tasks.
--
-- Backstory: the codebase has three parallel task tables that
-- accumulated over time:
--   • public.tasks       — old briefing/cron schema (date-only due,
--                          string `type` column, status='pending')
--   • public.lead_tasks  — legacy from the lead-centric era
--                          (assigned_agent_id, task_type, metadata_json)
--   • public.crm_tasks   — the current consolidated table the unified
--                          /dashboard/tasks view reads from
-- A bunch of writers (dailyBriefing, hot-call-task, tasks API) still
-- target `tasks` or assume lead_tasks columns on crm_tasks, so the
-- unified read view never actually surfaces briefing or AI-call rows.
-- Production confirms it: tasks=0, crm_tasks=0, lead_tasks=0; only
-- playbook_task_instances has data (35 rows). Zero-row tables make
-- this safe to consolidate without a data backfill.
--
-- This migration is purely additive: adds the columns crm_tasks needs
-- to absorb both legacy tables, plus a source column to drop the
-- title-prefix regex hack that detects briefing tasks. public.tasks
-- and public.lead_tasks stay in place (no writers after this PR; a
-- later migration drops them once we're sure nothing external reads).

-- ── crm_tasks: add the columns the legacy writers need ──────────────

alter table public.crm_tasks
  -- Provenance: where did this row come from? Lets the unified view
  -- render a chip per source without parsing titles. Default 'manual'
  -- matches the historical behavior (anything an agent created by
  -- hand). Add new values here as new writers come online.
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'briefing', 'ai_call', 'automation', 'playbook', 'legacy')),
  -- Free-text task category from the old `tasks.type` ("call",
  -- "follow_up", "voice_follow_up", etc.). Nullable because older
  -- writers didn't set it and it's mostly cosmetic.
  add column if not exists task_type text,
  -- Defer date for the old tasks-deferred cron (`/api/cron/tasks-deferred`).
  -- We could re-use snoozed_until (timestamptz) but keeping a date column
  -- means the cron's date<=today comparison stays trivially correct
  -- across timezones.
  add column if not exists deferred_until date,
  -- Bag for writer-specific extras (twilio_call_sid, escalation reasons, etc.).
  -- The hot-call writer already references this column and was failing
  -- silently before this migration adds it.
  add column if not exists metadata_json jsonb not null default '{}'::jsonb;

-- The unified view filters by source for the chip row. Partial index
-- on the common case (open, recent) keeps it cheap as task volume
-- grows; full-table sequential scans will still happen for the All
-- tab but that's bounded and infrequent.
create index if not exists idx_crm_tasks_agent_source_open
  on public.crm_tasks (agent_id, source)
  where status = 'open';

-- Cron-driven reactivation pattern.
create index if not exists idx_crm_tasks_deferred_until
  on public.crm_tasks (deferred_until)
  where deferred_until is not null;

comment on column public.crm_tasks.source is
  'Provenance discriminator: manual=agent-created, briefing=morning briefing cron, ai_call=hot-call escalation, automation=rule-driven, playbook=copied from playbook_task_instances, legacy=migrated from public.tasks.';
comment on column public.crm_tasks.metadata_json is
  'Writer-scoped extras (e.g. twilio_call_sid, escalation reasons). Schemaless — query with jsonb operators when needed.';

-- ── playbook_task_instances: add program_slug ───────────────────────
--
-- Coaching-program tasks are detected today by template_key startsWith
-- "producer_track" / "top_producer_track" — fragile. A dedicated slug
-- column lets new programs ship without a regex update.

alter table public.playbook_task_instances
  add column if not exists program_slug text;

create index if not exists idx_playbook_tasks_program_slug
  on public.playbook_task_instances (program_slug)
  where program_slug is not null;

-- Backfill from existing template_key values. No-op today (no
-- coaching rows in prod), but stays correct if any are added before
-- the matching writer change ships.
update public.playbook_task_instances
set program_slug =
  case
    when template_key like 'producer_track%' then 'producer_track'
    when template_key like 'top_producer_track%' then 'top_producer_track'
  end
where program_slug is null
  and template_key is not null
  and (template_key like 'producer_track%' or template_key like 'top_producer_track%');

comment on column public.playbook_task_instances.program_slug is
  'Coaching-program identifier (producer_track | top_producer_track). NULL for non-coaching playbooks.';

-- ── deprecate public.tasks + public.lead_tasks ──────────────────────
--
-- After this migration deploys, every writer/reader in apps/leadsmartai
-- targets crm_tasks. The two tables stay around for one release in
-- case anything external reads them; a follow-up migration drops
-- them once we're confident.

comment on table public.tasks is
  'DEPRECATED — use public.crm_tasks. Empty in prod as of 2026-06-04. Scheduled for drop in a future migration.';

comment on table public.lead_tasks is
  'DEPRECATED — use public.crm_tasks. Empty in prod as of 2026-06-04. Columns assigned_agent_id / task_type / metadata_json now live on crm_tasks.';
