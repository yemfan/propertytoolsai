-- Saved Smart Match searches for recurring alerts (e.g. daily digest).
-- lead_id is text (no FK) so one migration works whether public.leads.id is bigint or uuid.

create table if not exists public.lead_saved_searches (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null,
  preferences jsonb not null,
  frequency text not null default 'daily',
  last_sent_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_saved_searches_lead_id on public.lead_saved_searches (lead_id);
create index if not exists idx_lead_saved_searches_frequency on public.lead_saved_searches (frequency);

comment on table public.lead_saved_searches is
  'Subscribed Smart Match preferences for scheduled listing alerts.';
