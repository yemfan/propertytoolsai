-- Lead Ad campaign tracking for Generate Leads → Run Ads.
--
-- Phase 2B.1 (this migration): schema scaffold only. No code uses
-- these tables yet. The campaign wizard (Phase 2B.2) will read +
-- write them; the webhook handler (this PR) only needs the
-- form-id → page-id mapping that lives on the row's parent
-- social_account row.
--
-- Two tables:
--   lead_ad_campaigns — one row per agent-launched campaign on Meta
--   lead_ad_form_subscriptions — registry of which Meta lead-form
--     ids belong to which campaign, so the webhook handler can
--     route inbound leads by form_id.

create table if not exists public.lead_ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents (id) on delete cascade,
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,

  -- Meta-side identifiers, set when create() succeeds.
  meta_ad_account_id text,  -- 'act_<digits>'
  meta_campaign_id text,
  meta_adset_id text,
  meta_creative_id text,
  meta_ad_id text,
  meta_form_id text,

  -- Agent-facing labels
  name text not null,
  objective text not null default 'LEAD_GENERATION'
    check (objective in ('LEAD_GENERATION', 'TRAFFIC', 'REACH', 'POST_ENGAGEMENT')),

  -- Subject attribution — which listing or angle did this campaign
  -- run for. Free-text so we don't lock the schema; the wizard
  -- populates these from the same trigger/subject system Quick Post uses.
  trigger_kind text,
  subject_kind text,
  subject_ref_id text,

  -- Budget + schedule. Phase 2B.2 will populate; nullable so the
  -- table can be created without forcing every column.
  daily_budget_cents integer,
  lifetime_budget_cents integer,
  start_time timestamptz,
  end_time timestamptz,

  -- Targeting snapshot — what we sent to Meta. Stored as jsonb
  -- because Meta's targeting spec has dozens of optional fields
  -- and we don't want to chase Meta's schema with our own.
  targeting jsonb not null default '{}'::jsonb,

  -- Creative snapshot — caption, image url at create time, etc.
  creative jsonb not null default '{}'::jsonb,

  status text not null default 'draft'
    check (status in ('draft', 'creating', 'active', 'paused', 'completed', 'failed')),
  last_error text,

  -- Metrics — backfilled by Phase 2A.4-style insights job.
  metrics jsonb not null default '{}'::jsonb,
  metrics_refreshed_at timestamptz,

  -- Counts of leads received via the webhook. Cheap denormalized
  -- counter so the campaign list doesn't have to do a JOIN-and-count.
  leads_received_count integer not null default 0,
  last_lead_at timestamptz,

  launched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_ad_campaigns_agent_idx
  on public.lead_ad_campaigns (agent_id, created_at desc);

create index if not exists lead_ad_campaigns_status_idx
  on public.lead_ad_campaigns (status)
  where status in ('active', 'creating');

-- Webhook routing index: when a leadgen webhook fires, we look up
-- the campaign by Meta form id to attach the inbound lead to the
-- right campaign + agent.
create index if not exists lead_ad_campaigns_form_id_idx
  on public.lead_ad_campaigns (meta_form_id)
  where meta_form_id is not null;

comment on table public.lead_ad_campaigns is
  'Each Meta Lead Ad campaign launched via the Generate Leads → Run Ads wizard. Status + metrics + lead-counter live here.';

-- Audit log of every leadgen webhook event we received from Meta,
-- whether or not it matched a known campaign. Useful for forensic
-- "where did this lead come from" lookups, and for catching
-- mis-routed webhooks before they silently drop on the floor.
create table if not exists public.meta_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null
    check (event_type in ('leadgen', 'page', 'instagram', 'other')),

  -- Meta-side fields from the webhook payload (best-effort —
  -- nullable in case Meta changes its shape).
  meta_page_id text,
  meta_form_id text,
  meta_leadgen_id text,
  meta_ad_id text,
  meta_adgroup_id text,

  -- Cross-references to our internal rows (populated when we
  -- successfully matched + processed the event).
  campaign_id uuid references public.lead_ad_campaigns (id) on delete set null,
  contact_id text,  -- contacts.id — stringified to avoid the bigint/uuid type drift in the contacts table

  -- Raw payload retained for one week so audits can replay if
  -- needed. Trimmed by a future maintenance job.
  raw_payload jsonb not null default '{}'::jsonb,

  processed_at timestamptz,
  status text not null default 'received'
    check (status in ('received', 'processed', 'no_match', 'failed')),
  error_message text,

  created_at timestamptz not null default now()
);

create index if not exists meta_webhook_events_form_idx
  on public.meta_webhook_events (meta_form_id, created_at desc)
  where meta_form_id is not null;

create index if not exists meta_webhook_events_status_idx
  on public.meta_webhook_events (status, created_at desc);

comment on table public.meta_webhook_events is
  'Audit log of every webhook event received from Meta. One week retention; the maintenance job trims older rows.';
