-- Playbook task instances — soft cancel.
--
-- Phase 2 of the unified-tasks redesign: agents need to cancel a
-- playbook task without deleting it (audit history matters), and
-- defer one to a later date. Hard delete still exists for "I never
-- wanted this" mistakes; cancel is for "I considered it and decided
-- not to do this one".
--
-- Adds a single nullable timestamp. NULL = active, non-NULL = cancelled
-- with the timestamp recording when the agent cancelled it. Mutually
-- exclusive with completed_at: a row should never have both set, but
-- enforcement is application-level (no CHECK constraint — keeps the
-- door open for "completed then later marked cancelled" if we ever
-- change our minds).

alter table public.playbook_task_instances
  add column if not exists cancelled_at timestamptz;

-- Same partial-index treatment as the open-tasks index: most queries
-- filter to "active" tasks, which now means completed_at IS NULL AND
-- cancelled_at IS NULL.
create index if not exists idx_playbook_tasks_active
  on public.playbook_task_instances (agent_id, due_date)
  where completed_at is null and cancelled_at is null;
