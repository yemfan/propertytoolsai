-- Align crm_tasks priority check constraint with the rest of the codebase.
--
-- The TypeScript TaskPriority union is `low | normal | high | urgent`, and
-- the dashboard UI dropdowns offer those four values. But the historical
-- check constraint on this column accepted `low | medium | high | urgent` —
-- with `medium` instead of `normal`. The mismatch silently rejected every
-- task insert that used the default `normal` priority (UI add-task button,
-- daily briefings, AI-plan tasks, the new inbound-email webhook…).
--
-- Production confirmation: `select count(*) from crm_tasks` returns 0, i.e.
-- no task has ever successfully written through this code path. We've been
-- losing every "normal" task creation since this constraint was added.
--
-- Fix: allow BOTH `normal` (used by UI + most callers) AND `medium` (used
-- by ai-call, clientRecommendations, digestBuilder, etc.). Removing
-- `medium` would shift the breakage to the other half of the codebase.
-- Wider migration to consolidate on a single value can come later.

alter table public.crm_tasks
  drop constraint if exists crm_tasks_priority_check;

alter table public.crm_tasks
  add constraint crm_tasks_priority_check check (
    priority is null
    or priority = any (array['low'::text, 'normal'::text, 'medium'::text, 'high'::text, 'urgent'::text])
  );
