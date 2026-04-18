-- Behavioral tracking + saved searches — Phase A foundation.
--
-- Adds the data model for:
--   1. Per-contact saved searches (criteria + alert frequency)
--   2. Behavioral event ingestion (piggybacks on existing contact_events)
--   3. Intent signals (piggybacks on existing contact_signals with new types)
--   4. Nightly scoring (lands in existing contacts.engagement_score)
--
-- No new tables are strictly required — contact_events and contact_signals
-- both carry free-form text for event_type / signal_type. This migration
-- creates `contact_saved_searches` and adds indexes to support the
-- behavior-scoring cron query patterns efficiently.

-- =============================================================================
-- contact_saved_searches: per-contact "alert me when X matches Y"
-- =============================================================================

create table if not exists public.contact_saved_searches (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  agent_id bigint references public.agents(id) on delete cascade,

  -- Display + identity
  name text not null,                  -- "3bd under $1.2M in Monterey Park"

  -- Criteria: free-form JSON that the matcher translates to a Rentcast
  -- listings query. Shape (all optional):
  --   {
  --     "city": "Monterey Park",
  --     "state": "CA",
  --     "zip": "91754",
  --     "propertyType": "single_family" | "condo" | "townhouse",
  --     "priceMin": 800000,
  --     "priceMax": 1200000,
  --     "bedsMin": 3,
  --     "bathsMin": 2,
  --     "sqftMin": 1500,
  --     "radiusMiles": 2,            -- around an anchor address
  --     "anchorAddress": "1647 Arriba Dr"   -- for "watch this area"
  --   }
  criteria jsonb not null default '{}'::jsonb,

  -- Alert cadence. `never` stores the search without emailing (user reference only).
  alert_frequency text not null default 'daily'
    check (alert_frequency in ('instant','daily','weekly','never')),

  -- Matcher bookkeeping. `last_matched_listing_ids` lets us diff new matches
  -- from previously-alerted ones so the digest doesn't re-send the same
  -- listing every day.
  last_alerted_at timestamptz,
  last_matched_listing_ids jsonb not null default '[]'::jsonb,

  -- Soft-delete. Agents can "archive" a search without losing history of
  -- matches already sent.
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_contact_saved_searches_contact
  on public.contact_saved_searches(contact_id);
create index idx_contact_saved_searches_agent_active
  on public.contact_saved_searches(agent_id, is_active)
  where is_active = true;
create index idx_contact_saved_searches_alert_cadence
  on public.contact_saved_searches(alert_frequency, last_alerted_at)
  where is_active = true and alert_frequency <> 'never';

-- updated_at trigger
create or replace function public.touch_saved_searches_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists trg_saved_searches_updated_at on public.contact_saved_searches;
create trigger trg_saved_searches_updated_at
  before update on public.contact_saved_searches
  for each row execute function public.touch_saved_searches_updated_at();

-- =============================================================================
-- Indexes to support the behavior-scoring cron
-- =============================================================================

-- Scoring cron reads "all events for this contact in the last N days" per
-- contact. Agent-scoped variant for whole-book rollups.
create index if not exists idx_contact_events_contact_recent
  on public.contact_events(contact_id, created_at desc);

-- Intent-signal detection queries "same event_type, same payload.property_id,
-- repeated N times by same contact". Partial index on the hottest event types
-- keeps the hot-path query fast.
create index if not exists idx_contact_events_contact_type_recent
  on public.contact_events(contact_id, event_type, created_at desc)
  where event_type in (
    'property_view', 'property_favorite', 'search_performed',
    'return_visit', 'listing_alert_clicked', 'report_unlocked'
  );

-- =============================================================================
-- Smart List seed: "Hot this week" — contacts with intent signals
-- =============================================================================
--
-- Filter shape matches the existing ContactFilterConfig the TS side consumes.
-- `has_open_signals: true` + `updated_within_days: 7` narrows to contacts
-- that fired a signal or had engagement activity in the last week.

insert into public.smart_lists
  (agent_id, name, description, filter_config, sort_order, is_default)
select
  a.id,
  'Hot this week',
  'Contacts with recent intent signals or high engagement in the last 7 days.',
  '{"has_open_signals":true,"updated_within_days":7}'::jsonb,
  3,
  true
from public.agents a
on conflict (agent_id, name) do nothing;

-- Also update the seed trigger so new agents get this list too.
create or replace function public.seed_default_smart_lists()
returns trigger language plpgsql as $$
begin
  insert into public.smart_lists (agent_id, name, description, filter_config, sort_order, is_default)
  values
    (new.id, 'Leads',
     'Active pipeline — new inquiries and in-progress deals.',
     '{"lifecycle_stage":["lead","active_client"]}'::jsonb,
     0, true),
    (new.id, 'Sphere',
     'Past clients, referral sources, and non-client sphere contacts.',
     '{"lifecycle_stage":["past_client","sphere","referral_source"]}'::jsonb,
     1, true),
    (new.id, 'All contacts',
     'Every contact except archived.',
     '{"exclude_lifecycle_stage":["archived"]}'::jsonb,
     2, true),
    (new.id, 'Hot this week',
     'Contacts with recent intent signals or high engagement in the last 7 days.',
     '{"has_open_signals":true,"updated_within_days":7}'::jsonb,
     3, true)
  on conflict (agent_id, name) do nothing;
  return new;
end
$$;
