-- Phase 2 of the unified-tasks plan (Phase 1 shipped in #252).
--
-- Two structural additions so the merged tasks view at
-- /dashboard/tasks can drop its title-regex briefing detection
-- and so playbook tasks support the full ✓ / ✗ / snooze / edit
-- action set the agent expects on every task.
--
-- 1. crm_tasks.source — categorical column replacing the legacy
--    title-prefix detection. "manual" by default; existing
--    briefing-generated rows are backfilled by matching the same
--    title prefix the briefing cron writes ("Call hot lead: …" /
--    "Follow up with inactive lead: …"). Future briefing inserts
--    should set this column directly (separate code change).
--
-- 2. playbook_task_instances.cancelled_at — opt-in cancel state.
--    NULL = active, NOT NULL = cancelled at that time. Per the
--    user's note: rows that exist (i.e. agent kept them at apply-
--    time) get cancelled rather than deleted, preserving the
--    audit trail of "I started this and abandoned it" vs "I
--    never wanted it" (which doesn't insert at all — handled by
--    skipIndexes from #250).
--
-- Already applied to production via Supabase MCP — this file
-- exists so the repo's migration history matches prod.

-- ── crm_tasks.source ────────────────────────────────────────────
alter table public.crm_tasks
  add column if not exists source text not null default 'manual';

-- Constrain to the known source set so the unified view stays
-- predictable. We do this as add-then-validate to avoid breaking
-- existing rows that don't match (none should, but defensive).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'crm_tasks_source_check'
  ) then
    execute $sql$
      alter table public.crm_tasks
        add constraint crm_tasks_source_check
        check (source in ('manual', 'briefing', 'ai_followup', 'agent', 'system'))
    $sql$;
  end if;
end $$;

-- Backfill briefing rows by title prefix. Idempotent — running
-- twice doesn't change anything once the rows are tagged.
update public.crm_tasks
set source = 'briefing'
where source = 'manual'
  and (
    title ilike 'Call hot lead:%'
    or title ilike 'Follow up with inactive lead:%'
  );

create index if not exists idx_crm_tasks_agent_source_status
  on public.crm_tasks (agent_id, source, status);

comment on column public.crm_tasks.source is
  'Where the task came from: manual (agent-created), briefing (morning cron), ai_followup, agent (legacy), system.';

-- ── playbook_task_instances.cancelled_at ───────────────────────
alter table public.playbook_task_instances
  add column if not exists cancelled_at timestamptz;

-- Status now derives from the pair (completed_at, cancelled_at):
--   open      = both NULL
--   done      = completed_at NOT NULL, cancelled_at NULL
--   cancelled = cancelled_at NOT NULL (regardless of completed)
-- The unified view + service helpers in this PR enforce that.

create index if not exists idx_playbook_task_instances_cancelled_at
  on public.playbook_task_instances (agent_id, cancelled_at)
  where cancelled_at is null;

comment on column public.playbook_task_instances.cancelled_at is
  'Set when an agent cancels a previously-applied task. NULL = still active. Preserves audit trail vs. deleting the row.';
