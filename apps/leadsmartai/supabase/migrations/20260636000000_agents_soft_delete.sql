-- Soft-delete marker for agents.
--
-- Required for mobile account-deletion (Apple Guideline 5.1.1(v) and Google
-- Play account-deletion policy). The mobile DELETE /api/mobile/account
-- endpoint stamps `deleted_at` and nulls `auth_user_id` so the row no longer
-- joins to the Supabase auth user — that user is removed in the same call.
-- A separate purge job hard-deletes the agent and downstream data once the
-- review-window grace period elapses; we do not perform the cascade purge
-- synchronously because the FK shape across leads / posts / showings is not
-- uniformly cascading and a partial failure mid-request would leave the
-- account half-deleted.

alter table public.agents
  add column if not exists deleted_at timestamptz;

create index if not exists idx_agents_deleted_at
  on public.agents(deleted_at)
  where deleted_at is not null;
