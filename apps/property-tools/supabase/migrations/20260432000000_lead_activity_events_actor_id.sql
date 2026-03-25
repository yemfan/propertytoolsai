alter table if exists public.lead_activity_events
  add column if not exists actor_id text null;

comment on column public.lead_activity_events.actor_id is
  'Optional actor id (e.g. assigned agent) for system or agent events.';
