-- Contacts consolidation — Part 2 of 3: create the new unified schema.
--
-- Single `contacts` table (uuid id) with lifecycle_stage driving which UI
-- surface(s) the row appears in. Columns are the union of what leads and
-- sphere_contacts carried, plus TCPA consent fields (previously marked
-- "probably needed before real build" in 20260479200000_sphere_module.sql).

-- =============================================================================
-- contacts: the unified table
-- =============================================================================

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,

  -- Lifecycle: drives the Smart Lists (Leads, Sphere, All) and determines
  -- which columns below are expected to be populated.
  lifecycle_stage text not null default 'lead'
    check (lifecycle_stage in (
      'lead',             -- new inquiry, not yet qualified
      'active_client',    -- in an active deal (buyer rep, listing, etc.)
      'past_client',      -- closed with this agent before
      'sphere',           -- personal/professional contact, not a client
      'referral_source',  -- sends this agent referrals
      'archived'          -- cold/dead; hidden from default views
    )),

  -- Identity
  -- Legacy single-field name kept for backward compat with the 30+ routes
  -- that write `name: "John Smith"` directly. A trigger keeps it in sync
  -- with first_name/last_name below; a future cleanup removes the
  -- duplication once all callers write the split form.
  name text,
  first_name text,
  last_name text,
  email text,
  phone text,
  -- Formatted phone variant used by SMS paths. Kept separate from `phone`
  -- to match the legacy leads schema; a future cleanup can collapse them
  -- once the SMS state machine stops reading both.
  phone_number text,

  -- Addresses (three distinct semantic fields)
  address text,                -- where the contact lives
  property_address text,       -- subject property they're inquiring about (leads)
  closing_address text,        -- property they closed on (past_client)
  city text,                   -- derived from address, used by SMS local-context prompts
  state text,                  -- two-letter state code

  -- Funnel metadata
  source text,                 -- "Zillow", "Facebook Lead Ads", "referral", etc.
  rating text check (rating is null or rating in ('A','B','C','D','unrated')),
  notes text,

  -- Sub-state within lifecycle_stage. lifecycle_stage is the coarse bucket
  -- (lead/active_client/past_client/...) while lead_status tracks funnel
  -- micro-states: 'new' → 'contacted' → 'qualified' → 'won'/'lost'.
  -- No DB-level check here because the enum is still evolving; the TS layer
  -- validates.
  lead_status text,

  -- Engagement tracking
  engagement_score numeric default 0,
  -- Legacy alternate of engagement_score, preserved for the scoring/
  -- nurture pipeline. The two should reconcile in a follow-up.
  nurture_score numeric,
  -- Buyer/seller intent signal captured at form fill or SMS inference.
  intent text,
  last_activity_at timestamptz,
  last_contacted_at timestamptz,
  next_contact_at timestamptz,
  contact_frequency text,      -- daily | weekly | monthly | quarterly
  contact_method text,         -- email | sms | call | any
  -- Lead sub-type (e.g., 'buyer', 'seller', 'rental'). Separate from
  -- relationship_type which captures post-close vs. prospect status.
  lead_type text,
  -- Progressive-capture form stage ('name' → 'email' → 'phone' → 'complete').
  stage text,

  -- Search criteria (leads)
  search_location text,
  search_radius integer,
  price_min numeric,
  price_max numeric,
  beds integer,
  baths numeric,

  -- Prediction (rebuild placeholders — the old scoring engine is dropped in
  -- part 1, rebuild incrementally against this schema)
  prediction_score numeric,
  prediction_label text,
  prediction_factors jsonb,
  prediction_computed_at timestamptz,

  -- Automation
  automation_disabled boolean not null default false,
  report_id uuid,              -- links to property_reports when lead came from a report
  property_id uuid,            -- links to properties table when applicable

  -- Transaction (past_client, referral_source)
  closing_date date,
  closing_price numeric,
  avm_current numeric,
  avm_updated_at timestamptz,

  -- Relationship typing (sub-classification within post-close lifecycle_stages)
  relationship_type text
    check (relationship_type is null or relationship_type in (
      'past_buyer',
      'past_seller',
      'past_both',            -- bought AND sold with this agent
      'sphere',
      'referral_source',
      'prospect'
    )),
  relationship_tag text,       -- free-form: "college friend", "met at open house"
  anniversary_opt_in boolean not null default false,

  -- Consent & preferences (TCPA §2.8 — required from day 1 per product owner)
  preferred_language text not null default 'en',
  do_not_contact_sms boolean not null default false,
  do_not_contact_email boolean not null default false,
  tcpa_consent_at timestamptz,
  tcpa_consent_source text
    check (tcpa_consent_source is null or tcpa_consent_source in (
      'web_form',
      'imported_with_written_consent',
      'verbal',
      'written',
      'manual_entry'
    )),
  tcpa_consent_ip text,

  -- Legacy SMS consent flag. Kept alongside tcpa_consent_at because the
  -- SMS state machine (/api/sms/webhook, cron/send-emails) reads this
  -- directly. Treat it as "SMS opt-in confirmed" — setting
  -- tcpa_consent_at should also flip this true in the service layer.
  sms_opt_in boolean not null default false,

  -- SMS state machine columns (preserved from legacy leads schema).
  -- Future cleanup: collapse into a child `contact_sms_state` table.
  sms_ai_enabled boolean not null default true,
  sms_agent_takeover boolean not null default false,
  sms_followup_stage text,
  sms_last_outbound_at timestamptz,
  sms_last_inbound_at timestamptz,

  -- Pipeline (rebuild against contacts if/when pipeline_stages table returns)
  pipeline_stage_id uuid,

  -- Display
  avatar_color text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_contacts_agent on public.contacts(agent_id);
create index idx_contacts_agent_lifecycle on public.contacts(agent_id, lifecycle_stage);
create index idx_contacts_agent_last_contacted on public.contacts(agent_id, last_contacted_at desc);
create index idx_contacts_agent_next_contact on public.contacts(agent_id, next_contact_at)
  where next_contact_at is not null;
create index idx_contacts_agent_created on public.contacts(agent_id, created_at desc);
create index idx_contacts_agent_rating on public.contacts(agent_id, rating)
  where rating is not null;
create index idx_contacts_agent_engagement on public.contacts(agent_id, engagement_score desc);

-- Email dedup: at most one row per (agent, lower(email)). Enforces the
-- "auto-merge on lower(email)" rule at the database layer so a partial
-- import or a double-submit cannot create ghosts.
create unique index uq_contacts_agent_email
  on public.contacts(agent_id, lower(email))
  where email is not null;

-- updated_at trigger
create or replace function public.touch_contacts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger trg_contacts_updated_at
  before update on public.contacts
  for each row execute function public.touch_contacts_updated_at();


-- Keep `name` <-> `first_name`/`last_name` in sync. Writes to legacy `name`
-- populate first_name/last_name (whitespace-split). Writes to
-- first_name/last_name populate name. This lets us consolidate callers
-- incrementally without a flag-day cutover.
create or replace function public.sync_contacts_name_fields()
returns trigger language plpgsql as $$
declare
  idx int;
begin
  -- If the caller provided new first_name/last_name and not `name`,
  -- rebuild name from the split fields.
  if (
    (tg_op = 'INSERT' and new.name is null and (new.first_name is not null or new.last_name is not null))
    or
    (tg_op = 'UPDATE' and (new.first_name is distinct from old.first_name or new.last_name is distinct from old.last_name)
      and new.name is not distinct from old.name)
  ) then
    new.name := nullif(trim(coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, '')), '');
  end if;

  -- If the caller provided new `name` and not first_name/last_name,
  -- split on first whitespace.
  if (
    (tg_op = 'INSERT' and new.name is not null and new.first_name is null and new.last_name is null)
    or
    (tg_op = 'UPDATE' and new.name is distinct from old.name
      and new.first_name is not distinct from old.first_name
      and new.last_name is not distinct from old.last_name)
  ) then
    idx := position(' ' in trim(new.name));
    if idx = 0 then
      new.first_name := trim(new.name);
      new.last_name := null;
    else
      new.first_name := substring(trim(new.name) from 1 for idx - 1);
      new.last_name := nullif(trim(substring(trim(new.name) from idx + 1)), '');
    end if;
  end if;

  return new;
end
$$;

create trigger trg_contacts_sync_name
  before insert or update on public.contacts
  for each row execute function public.sync_contacts_name_fields();


-- =============================================================================
-- contact_signals: life-event / equity / refi / job-change signals
-- Renamed from sphere_signals, contact_id now uuid FK to contacts.
-- =============================================================================

create table public.contact_signals (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,

  signal_type text not null
    check (signal_type in (
      'refi_detected',
      'equity_milestone',
      'job_change',
      'anniversary_due',
      'listing_activity',
      'life_event_other'
    )),

  label text not null,
  confidence text not null default 'medium'
    check (confidence in ('low','medium','high')),
  suggested_action text,
  payload jsonb not null default '{}'::jsonb,

  detected_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  dismissed_at timestamptz,

  created_at timestamptz not null default now()
);

create index idx_contact_signals_contact on public.contact_signals(contact_id);
create index idx_contact_signals_open
  on public.contact_signals(contact_id)
  where dismissed_at is null;
create index idx_contact_signals_detected on public.contact_signals(detected_at desc);


-- =============================================================================
-- contact_triggers: per-contact trigger overrides for template sends
-- Renamed from sphere_contact_triggers, contact_id now uuid.
-- =============================================================================

create table public.contact_triggers (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  template_id uuid,            -- FK to templates table added when templates migration is rebuilt
  enabled boolean not null default true,
  status_override text,        -- 'paused' | 'muted' | null
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, template_id)
);

create index idx_contact_triggers_contact on public.contact_triggers(contact_id);


-- =============================================================================
-- contact_events: engagement/activity log (rebuilt from lead_events, uuid)
-- =============================================================================

create table public.contact_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,

  event_type text not null,    -- 'email_sent' | 'sms_sent' | 'call_made' | 'note_added' | 'lead_captured' | ...
  payload jsonb not null default '{}'::jsonb,
  source text,                 -- 'manual' | 'cron' | 'webhook' | 'ai'

  created_at timestamptz not null default now()
);

create index idx_contact_events_contact on public.contact_events(contact_id, created_at desc);
create index idx_contact_events_agent on public.contact_events(agent_id, created_at desc);
create index idx_contact_events_type on public.contact_events(event_type, created_at desc);


-- =============================================================================
-- contact_scores: rebuild of lead_scores, uuid
-- =============================================================================

create table public.contact_scores (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,

  score numeric not null,
  label text,                  -- 'hot' | 'warm' | 'cold' | custom
  factors jsonb not null default '{}'::jsonb,
  model_version text,

  computed_at timestamptz not null default now()
);

create index idx_contact_scores_contact on public.contact_scores(contact_id, computed_at desc);
create index idx_contact_scores_agent_label on public.contact_scores(agent_id, label);


-- =============================================================================
-- crm_tasks: rebuild with uuid contact_id
-- =============================================================================

create table public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,  -- nullable: tasks can be standalone

  title text not null,
  description text,
  due_at timestamptz,
  status text not null default 'open'
    check (status in ('open','in_progress','done','snoozed','cancelled')),
  priority text
    check (priority is null or priority in ('low','medium','high','urgent')),

  completed_at timestamptz,
  snoozed_until timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_crm_tasks_agent on public.crm_tasks(agent_id, status, due_at);
create index idx_crm_tasks_contact on public.crm_tasks(contact_id)
  where contact_id is not null;
create index idx_crm_tasks_agent_due on public.crm_tasks(agent_id, due_at)
  where status in ('open','in_progress');


-- =============================================================================
-- automation_logs: rebuild with uuid contact_id
-- Parent table `automation_rules` stays as-is (no FK to leads — was already
-- agent-scoped).
-- =============================================================================

create table public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  rule_id uuid references public.automation_rules(id) on delete cascade,

  event text not null,         -- 'fired' | 'skipped' | 'errored' | 'dry_run'
  reason text,
  payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index idx_automation_logs_agent on public.automation_logs(agent_id, created_at desc);
create index idx_automation_logs_contact on public.automation_logs(contact_id, created_at desc)
  where contact_id is not null;
create index idx_automation_logs_rule on public.automation_logs(rule_id, created_at desc)
  where rule_id is not null;
