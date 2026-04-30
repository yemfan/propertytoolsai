-- Column-level drift catch-up — adds the columns whose original
-- migrations targeted public.leads (now a view) or were never run
-- against the live DB. Limited to columns the active code base
-- actually queries (verified via grep on apps/leadsmartai/{app,lib}).
--
-- Skipped intentionally:
--   • user_profiles billing columns (stripe_customer_id, subscription_*,
--     tokens_*, trial_*, plan, role, brokerage, license_number, …) —
--     those features migrated to public.leadsmart_users; the
--     user_profiles ALTER migrations are stale.
--   • _agent_pk_migrate transient columns from in-flight schema swaps.
--   • Tier-2 contacts columns whose names collide with already-live
--     equivalents (zip vs zip_code, score vs confidence_score,
--     location vs full_address, etc.).
--
-- Idempotent — every ADD COLUMN uses IF NOT EXISTS so the migration
-- can be re-run without effect once applied.

-- ── contacts: greeting + enrichment + dedup column gaps ─────────────
alter table public.contacts
  add column if not exists birthday date,
  add column if not exists home_purchase_date date,
  add column if not exists preferred_contact_channel text,
  add column if not exists preferred_contact_time text,
  add column if not exists contact_opt_out_email boolean not null default false,
  add column if not exists contact_opt_out_sms boolean not null default false,
  add column if not exists relationship_stage text,
  add column if not exists lead_tags_json jsonb not null default '[]'::jsonb,
  add column if not exists contact_completeness_score integer not null default 0,
  add column if not exists enrichment_status text,
  add column if not exists inferred_contact_type text,
  add column if not exists inferred_lifecycle_stage text,
  add column if not exists duplicate_group_key text,
  add column if not exists notes_summary text,
  add column if not exists normalized_email text,
  add column if not exists normalized_phone text,
  add column if not exists normalized_address text,
  add column if not exists mailing_address text,
  add column if not exists sms_opted_out_at timestamptz;

-- merged_into_lead_id is a self-FK; original migration used bigint
-- because contacts was previously called `leads`. Repointed to
-- contacts(id) (uuid). Code in lib/contact-enrichment/* reads + sets
-- this field with 13 callers — naming kept as merged_into_lead_id
-- (not _contact_id) to avoid a separate code rename.
alter table public.contacts
  add column if not exists merged_into_lead_id uuid
    references public.contacts(id) on delete set null;

create index if not exists idx_contacts_normalized_email
  on public.contacts(normalized_email)
  where normalized_email is not null;
create index if not exists idx_contacts_normalized_phone
  on public.contacts(normalized_phone)
  where normalized_phone is not null;
create index if not exists idx_contacts_duplicate_group_key
  on public.contacts(duplicate_group_key)
  where duplicate_group_key is not null;
create index if not exists idx_contacts_merged_into
  on public.contacts(merged_into_lead_id)
  where merged_into_lead_id is not null;

comment on column public.contacts.preferred_contact_channel is
  'sms | email | both — used by smart greeting routing';
comment on column public.contacts.lead_tags_json is
  'Arbitrary string tags for segmentation (JSON array of strings).';
comment on column public.contacts.merged_into_lead_id is
  'When set, this contact is archived as a duplicate of the referenced contact.';
comment on column public.contacts.duplicate_group_key is
  'Optional stable key for grouping related duplicates (e.g. hash of email+phone).';

-- ── lead_calls: call-lifecycle metadata ─────────────────────────────
alter table public.lead_calls
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists needs_human boolean not null default false,
  add column if not exists inferred_intent text;

create index if not exists idx_lead_calls_started_at
  on public.lead_calls(started_at desc)
  where started_at is not null;

-- ── subscription_events: arbitrary event metadata ───────────────────
alter table public.subscription_events
  add column if not exists metadata jsonb not null default '{}'::jsonb;
