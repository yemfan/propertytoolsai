-- ALL-IN-ONE MIGRATION (DEV/PROD)
-- Smart Lead Management (follow-ups) + Lead Engagement Tracking
--
-- Includes:
-- - leads: rating/contact cadence fields + engagement fields
-- - communications table (email/sms logs)
-- - lead_events table (engagement events)
-- - log_lead_event() function (atomic scoring + debouncing)
--
-- Safe to re-run (uses IF EXISTS / IF NOT EXISTS).

-- =========================
-- LEADS: follow-up fields
-- =========================
alter table if exists public.leads
  add column if not exists rating text not null default 'warm',
  add column if not exists contact_frequency text not null default 'weekly',
  add column if not exists contact_method text not null default 'email',
  add column if not exists last_contacted_at timestamptz,
  add column if not exists next_contact_at timestamptz not null default (now() + interval '7 days');

create index if not exists idx_leads_next_contact_at on public.leads(next_contact_at);
create index if not exists idx_leads_rating on public.leads(rating);

-- =========================
-- LEADS: engagement fields
-- =========================
alter table if exists public.leads
  add column if not exists engagement_score int not null default 0,
  add column if not exists last_activity_at timestamptz;

create index if not exists idx_leads_last_activity_at on public.leads(last_activity_at desc);
create index if not exists idx_leads_engagement_score on public.leads(engagement_score desc);

-- =========================
-- COMMUNICATIONS: agent follow-ups
-- =========================
create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  -- NOTE: leads.id is BIGINT in this project, so lead_id must be BIGINT too.
  lead_id bigint not null references public.leads(id) on delete cascade,
  agent_id uuid,
  type text not null, -- email | sms
  content text not null,
  status text not null, -- sent | failed
  created_at timestamptz not null default now()
);

create index if not exists idx_communications_lead_id_created_at
  on public.communications(lead_id, created_at desc);
create index if not exists idx_communications_agent_id_created_at
  on public.communications(agent_id, created_at desc);

-- =========================
-- LEAD EVENTS: engagement tracking
-- =========================
create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  -- NOTE: leads.id is BIGINT in this project, so lead_id must be BIGINT too.
  lead_id bigint not null references public.leads(id) on delete cascade,
  agent_id uuid,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_events_lead_id_created_at
  on public.lead_events(lead_id, created_at desc);
create index if not exists idx_lead_events_agent_id_created_at
  on public.lead_events(agent_id, created_at desc);
create index if not exists idx_lead_events_event_type_created_at
  on public.lead_events(event_type, created_at desc);

-- =========================
-- Atomic scoring + debouncing
-- =========================
create or replace function public.log_lead_event(
  p_lead_id bigint,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_agent_id uuid;
  v_score_delta int := 0;
  v_window interval := interval '0 minutes';
  v_now timestamptz := now();
  v_last_event timestamptz;
  v_new_score int;
begin
  if p_lead_id is null or coalesce(nullif(trim(p_event_type), ''), '') = '' then
    return jsonb_build_object('ok', false, 'message', 'Invalid input');
  end if;

  -- Score mapping
  if p_event_type = 'email_open' then
    v_score_delta := 5;
    v_window := interval '10 minutes';
  elsif p_event_type = 'link_click' then
    v_score_delta := 10;
    v_window := interval '1 minute';
  elsif p_event_type = 'report_view' then
    v_score_delta := 20;
    v_window := interval '5 minutes';
  else
    v_score_delta := 0;
    v_window := interval '1 minute';
  end if;

  -- Lock lead row and derive agent_id
  select agent_id into v_agent_id
  from public.leads
  where id = p_lead_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Lead not found');
  end if;

  -- Debounce: if same event type happened recently, skip scoring + insert
  select max(created_at) into v_last_event
  from public.lead_events
  where lead_id = p_lead_id
    and event_type = p_event_type
    and created_at >= (v_now - v_window);

  if v_last_event is not null then
    update public.leads
      set last_activity_at = v_now
    where id = p_lead_id
    returning engagement_score into v_new_score;

    return jsonb_build_object('ok', true, 'debounced', true, 'engagement_score', v_new_score);
  end if;

  insert into public.lead_events(lead_id, agent_id, event_type, metadata)
  values (p_lead_id, v_agent_id, p_event_type, coalesce(p_metadata, '{}'::jsonb));

  update public.leads
    set engagement_score = greatest(0, engagement_score + v_score_delta),
        last_activity_at = v_now
  where id = p_lead_id
  returning engagement_score into v_new_score;

  return jsonb_build_object(
    'ok', true,
    'debounced', false,
    'score_delta', v_score_delta,
    'engagement_score', v_new_score
  );
end;
$$;

