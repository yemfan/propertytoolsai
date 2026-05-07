-- RPCs that power the agent dashboard's "Recent activity from your
-- leads" feed and the hot-lead intent-signal badge.
--
-- Why RPCs (not raw supabase-js queries): we need to join across
-- `public.contacts` (agent_id), `auth.users` (canonical email), and
-- `public.tool_events` (consumer activity). The auth schema isn't
-- exposed via PostgREST by default, so a single SQL function is
-- the cleanest path. Both functions are SECURITY DEFINER so they
-- can read auth.users, and they accept the agent_id explicitly so
-- the API route enforces authorization in JS before invocation.

-- ── 1. Activity feed ────────────────────────────────────────────
-- Returns recent PropertyToolsAI tool_events for the agent's
-- claimed contacts. The "claim" relationship is contacts.agent_id
-- (set by /api/dashboard/lead-queue/claim — first-come-first-served
-- on contacts where agent_id was null).

create or replace function public.get_agent_lead_activity(
  p_agent_id bigint,
  p_limit int default 20
)
returns table (
  lead_id uuid,
  lead_name text,
  lead_email text,
  tool_name text,
  event_name text,
  metadata jsonb,
  occurred_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  select
    c.id as lead_id,
    coalesce(
      nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''),
      c.name,
      split_part(c.email, '@', 1)
    ) as lead_name,
    c.email as lead_email,
    te.tool_name,
    te.event_name,
    te.metadata,
    te.created_at as occurred_at
  from public.contacts c
  join auth.users au on lower(au.email) = lower(c.email)
  join public.tool_events te on te.user_id = au.id
  where c.agent_id = p_agent_id
    and c.email is not null
    and c.email <> ''
  order by te.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

grant execute on function public.get_agent_lead_activity(bigint, int)
  to authenticated, service_role;

comment on function public.get_agent_lead_activity is
  'Returns recent PropertyToolsAI tool_events for an agent''s claimed contacts, joined via case-insensitive email match against auth.users. Powers the agent dashboard activity feed.';

-- ── 2. Hot-lead intent counts ───────────────────────────────────
-- Per-lead count of tool_events in the last N hours. Used to badge
-- hot leads with a "tool uses in 24h" intent signal. Returns a row
-- per lead in the input array (zero-count rows included via left
-- join), so the UI can render a badge for every hot lead without a
-- per-lead waterfall.

create or replace function public.get_lead_recent_tool_use_counts(
  p_agent_id bigint,
  p_lead_ids uuid[],
  p_window_hours int default 24
)
returns table (
  lead_id uuid,
  use_count bigint,
  last_event_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  with bounded as (
    select
      c.id,
      c.email
    from public.contacts c
    where c.agent_id = p_agent_id
      and c.id = any(p_lead_ids)
      and c.email is not null
      and c.email <> ''
  )
  select
    b.id as lead_id,
    count(te.id) as use_count,
    max(te.created_at) as last_event_at
  from bounded b
  left join auth.users au on lower(au.email) = lower(b.email)
  left join public.tool_events te
    on te.user_id = au.id
   and te.created_at >= now() - make_interval(hours => greatest(1, least(coalesce(p_window_hours, 24), 168)))
  group by b.id;
$$;

grant execute on function public.get_lead_recent_tool_use_counts(bigint, uuid[], int)
  to authenticated, service_role;

comment on function public.get_lead_recent_tool_use_counts is
  'For each lead in p_lead_ids owned by p_agent_id, returns the count of PropertyToolsAI tool_events in the last p_window_hours hours plus the most recent event timestamp. Powers the hot-lead intent badge on the agent dashboard.';
