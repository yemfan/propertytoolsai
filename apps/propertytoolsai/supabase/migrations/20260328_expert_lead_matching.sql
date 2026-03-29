-- Expert CTA / AI comparison lead capture: agent matching + structured context

alter table if exists public.agents
  add column if not exists service_areas text[] not null default '{}',
  add column if not exists accepts_new_leads boolean not null default true;

comment on column public.agents.service_areas is 'Lowercase city names and/or 5-digit zips this agent serves; empty = open to any region (lower match priority).';
comment on column public.agents.accepts_new_leads is 'When false, excluded from automatic expert matching.';

create index if not exists idx_agents_accepts_new_leads
  on public.agents(accepts_new_leads)
  where accepts_new_leads = true;

alter table if exists public.leads
  add column if not exists capture_context jsonb;

comment on column public.leads.capture_context is 'Structured tool payload (e.g. AI comparison subject, rows, recommendation).';

create index if not exists idx_leads_capture_context
  on public.leads using gin (capture_context)
  where capture_context is not null;
