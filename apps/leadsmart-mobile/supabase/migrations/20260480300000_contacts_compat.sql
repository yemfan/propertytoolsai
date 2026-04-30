-- Contacts compat layer for apps/propertytoolsai.
--
-- The contacts-consolidation migration (20260480000000..20260480200000)
-- dropped public.leads and rebuilt the schema under `contacts`, but only
-- apps/leadsmartai's code was refactored in the same PR. apps/propertytoolsai
-- (~65 files) still runs `.from("leads")`, `.from("lead_events")`,
-- `.from("lead_scores")`, and `.from("sphere_contacts")` against the shared
-- Supabase project. Every propertytoolsai-side write is now failing with
-- 42P01 "relation does not exist".
--
-- Rather than refactor 65 more files under time pressure, this migration
-- (1) adds the extra columns that propertytoolsai's leads schema had
--     (full_address, zip_code, estimated_home_value, source_session_id,
--     confidence, timeline, status alias, etc.)
-- (2) creates updatable views `leads`, `lead_events`, `lead_scores`, and
--     `sphere_contacts` that proxy reads and writes to the new tables.
--
-- Postgres auto-updatable view rules: a view is INSERT/UPDATE/DELETE-able
-- if it is a simple SELECT from exactly one table, with no aggregates, no
-- DISTINCT, no GROUP BY, no WITH, and no window functions. All four views
-- below satisfy that, so inserts through the views land directly in the
-- underlying table.

-- =============================================================================
-- Extra columns used by propertytoolsai's leads writes
-- =============================================================================

alter table public.contacts
  add column if not exists full_address text,
  add column if not exists zip_code text,
  add column if not exists estimated_home_value numeric,
  add column if not exists source_session_id text,
  add column if not exists estimate_high numeric,
  add column if not exists estimate_low numeric,
  add column if not exists confidence text,
  add column if not exists confidence_score numeric,
  add column if not exists email_domain text,
  add column if not exists lead_quality text,
  add column if not exists source_detail text,
  add column if not exists buying_or_selling text,
  add column if not exists timeline text,
  add column if not exists traffic_source text,
  add column if not exists tool_used text,
  add column if not exists status text;  -- alias of lead_status for legacy writers

-- Keep status <-> lead_status in sync so queries on either column see the
-- same value. Writes to either side propagate to the other.
create or replace function public.sync_contacts_status_fields()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.status is not null and new.lead_status is null then
      new.lead_status := new.status;
    elsif new.lead_status is not null and new.status is null then
      new.status := new.lead_status;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status and new.lead_status is not distinct from old.lead_status then
      new.lead_status := new.status;
    elsif new.lead_status is distinct from old.lead_status and new.status is not distinct from old.status then
      new.status := new.lead_status;
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists trg_contacts_sync_status on public.contacts;
create trigger trg_contacts_sync_status
  before insert or update on public.contacts
  for each row execute function public.sync_contacts_status_fields();

-- =============================================================================
-- Compatibility views — read and write against the legacy table names
-- =============================================================================

-- leads → contacts
create or replace view public.leads as
select * from public.contacts;

-- lead_events → contact_events
create or replace view public.lead_events as
select
  id,
  contact_id,
  contact_id as lead_id,  -- legacy column name alias for reads
  agent_id,
  event_type,
  payload,
  source,
  created_at
from public.contact_events;

-- A view with a derived column (`lead_id` alias) is not auto-updatable.
-- Add INSTEAD OF INSERT so propertytoolsai's `.from("lead_events").insert({
-- lead_id: ..., event_type: ... })` still lands in contact_events.
create or replace function public.lead_events_insert_redirect()
returns trigger language plpgsql as $$
begin
  insert into public.contact_events (contact_id, agent_id, event_type, payload, source)
  values (
    coalesce(new.contact_id, new.lead_id),
    new.agent_id,
    new.event_type,
    coalesce(new.payload, '{}'::jsonb),
    new.source
  );
  return new;
end
$$;

drop trigger if exists lead_events_insert_redirect on public.lead_events;
create trigger lead_events_insert_redirect
  instead of insert on public.lead_events
  for each row execute function public.lead_events_insert_redirect();

-- lead_scores → contact_scores
create or replace view public.lead_scores as
select
  id,
  contact_id,
  contact_id as lead_id,
  agent_id,
  score,
  label,
  factors,
  model_version,
  computed_at
from public.contact_scores;

create or replace function public.lead_scores_insert_redirect()
returns trigger language plpgsql as $$
begin
  insert into public.contact_scores (contact_id, agent_id, score, label, factors, model_version, computed_at)
  values (
    coalesce(new.contact_id, new.lead_id),
    new.agent_id,
    new.score,
    new.label,
    coalesce(new.factors, '{}'::jsonb),
    new.model_version,
    coalesce(new.computed_at, now())
  );
  return new;
end
$$;

drop trigger if exists lead_scores_insert_redirect on public.lead_scores;
create trigger lead_scores_insert_redirect
  instead of insert on public.lead_scores
  for each row execute function public.lead_scores_insert_redirect();

-- sphere_contacts → contacts (filtered to post-close lifecycle stages, but
-- the legacy writers don't care about the filter — they just write to the
-- name they know). For SELECT, scope to sphere-ish rows; for INSERT via
-- INSTEAD OF we let everything through since legacy CSV import already
-- handles the lifecycle mapping.
create or replace view public.sphere_contacts as
select * from public.contacts
where lifecycle_stage in ('past_client', 'sphere', 'referral_source');
-- Writes through sphere_contacts view hit the base contacts table. The
-- legacy code sets relationship_type explicitly, and contacts.
-- lifecycle_stage defaults to 'lead' — so we need an INSTEAD OF INSERT
-- to preserve the caller's intent and pick a sensible lifecycle_stage.
create or replace function public.sphere_contacts_insert_redirect()
returns trigger language plpgsql as $$
declare
  resolved_stage text;
begin
  resolved_stage := case
    when new.lifecycle_stage is not null then new.lifecycle_stage
    when new.relationship_type in ('past_buyer','past_seller','past_both') then 'past_client'
    when new.relationship_type = 'referral_source' then 'referral_source'
    else 'sphere'
  end;

  insert into public.contacts (
    agent_id, lifecycle_stage,
    name, first_name, last_name, email, phone, phone_number,
    address, property_address, closing_address, city, state, zip_code,
    source, rating, notes, lead_status, status,
    engagement_score, nurture_score, intent,
    last_activity_at, last_contacted_at, next_contact_at,
    contact_frequency, contact_method, lead_type, stage,
    search_location, price_min, price_max, beds, baths,
    closing_date, closing_price, avm_current, avm_updated_at,
    relationship_type, relationship_tag, anniversary_opt_in,
    preferred_language, do_not_contact_sms, do_not_contact_email,
    tcpa_consent_at, tcpa_consent_source, tcpa_consent_ip,
    sms_opt_in, sms_ai_enabled, sms_agent_takeover,
    full_address, estimated_home_value, source_session_id,
    avatar_color
  ) values (
    new.agent_id, resolved_stage,
    new.name, new.first_name, new.last_name, new.email, new.phone, new.phone_number,
    new.address, new.property_address, new.closing_address, new.city, new.state, new.zip_code,
    new.source, new.rating, new.notes, new.lead_status, new.status,
    coalesce(new.engagement_score, 0), new.nurture_score, new.intent,
    new.last_activity_at, new.last_contacted_at, new.next_contact_at,
    new.contact_frequency, new.contact_method, new.lead_type, new.stage,
    new.search_location, new.price_min, new.price_max, new.beds, new.baths,
    new.closing_date, new.closing_price, new.avm_current, new.avm_updated_at,
    new.relationship_type, new.relationship_tag, coalesce(new.anniversary_opt_in, false),
    coalesce(new.preferred_language, 'en'),
    coalesce(new.do_not_contact_sms, false), coalesce(new.do_not_contact_email, false),
    new.tcpa_consent_at, new.tcpa_consent_source, new.tcpa_consent_ip,
    coalesce(new.sms_opt_in, false), coalesce(new.sms_ai_enabled, true),
    coalesce(new.sms_agent_takeover, false),
    new.full_address, new.estimated_home_value, new.source_session_id,
    new.avatar_color
  );
  return new;
end
$$;

drop trigger if exists sphere_contacts_insert_redirect on public.sphere_contacts;
create trigger sphere_contacts_insert_redirect
  instead of insert on public.sphere_contacts
  for each row execute function public.sphere_contacts_insert_redirect();
