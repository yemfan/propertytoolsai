-- Reconcile `mobile_push_tokens` to match the committed migration
-- spec at 20260453500000_mobile_push_tokens.sql.
--
-- Prod somehow diverged from the migration file — the live table
-- has only `(user_id, token, platform, created_at, updated_at)`
-- while the migration spec includes `agent_id`, `expo_push_token`
-- (the renamed `token`), `device_id`, `app_version` plus a platform
-- check constraint and the agent_id index. The application code in
-- lib/mobile/push.ts + pushTokens.ts was written against the
-- migration spec, so every push registration call silently fails
-- against the live schema (the .from("mobile_push_tokens").upsert
-- 400s on the unknown columns; the .select("expo_push_token") 500s
-- on the missing column). End result: no mobile push has ever
-- worked in prod.
--
-- This migration realigns prod with the repo. Safe to apply: the
-- table has zero rows at the time of writing, so the column rename
-- doesn't risk data drift.
--
-- Why a realign instead of bending code/migration to match prod's
-- simpler shape: the `agent_id` scope + `device_id` + `app_version`
-- columns aren't dead weight — they're how we'd scope tokens to a
-- specific agent (multi-account future), prune stale tokens on
-- Expo's bad-receipt feedback, and segment by app version when an
-- iOS-only crash needs a targeted push to only matching tokens.
-- The original migration design was right.

-- 1. Rename `token` → `expo_push_token`. Constraint + index names
--    that reference the old column name follow automatically.
alter table public.mobile_push_tokens
  rename column token to expo_push_token;

-- 2. Add the missing columns. All nullable so existing (zero) rows
--    don't need a backfill; the agent_id FK has on-delete-cascade
--    matching the original migration spec.
alter table public.mobile_push_tokens
  add column if not exists agent_id bigint references public.agents (id) on delete cascade,
  add column if not exists device_id text,
  add column if not exists app_version text;

-- 3. Platform check constraint. Prod's table didn't have one; the
--    migration spec did. Add it defensively (existing rows count
--    is 0 so no risk of constraint-violation).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mobile_push_tokens_platform_check'
  ) then
    execute $sql$
      alter table public.mobile_push_tokens
        add constraint mobile_push_tokens_platform_check
        check (platform in ('ios', 'android', 'web', 'unknown'))
    $sql$;
  end if;
end $$;

-- 4. Agent-scope index from the original migration. The user-scope
--    one (idx_mobile_push_tokens_user_id) is already covered by a
--    differently-named index on prod (`mobile_push_tokens_user_id`)
--    so we skip recreating it.
create index if not exists idx_mobile_push_tokens_agent_id
  on public.mobile_push_tokens (agent_id)
  where agent_id is not null;

comment on table public.mobile_push_tokens is
  'Expo push tokens for LeadSmart mobile; updated via /api/mobile/push/register. Realigned with migration spec 2026-05-13.';
