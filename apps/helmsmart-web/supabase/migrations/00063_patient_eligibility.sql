-- 00063_patient_eligibility.sql
--
-- DoctorSmart Phase 1: real-time insurance eligibility (X12 270/271 via the Stedi
-- clearinghouse). This is a MEDICAL-only feature, but the columns/table are added
-- to the shared schema (applied to Core + the doctorsmart project) so the single
-- codebase + generated types stay consistent. They are only surfaced in the UI
-- under the `medical` pack.
--
-- Applied to: Core (vpmwsnoosuiknyzdxgtk) AND doctorsmart (mxehimahbvxzmbvqhstm).

-- Practice identifier used as the requesting provider in a 270 request.
alter table organizations add column if not exists npi text;

-- Patient identifiers needed to build a 270 eligibility request.
alter table clients add column if not exists date_of_birth        date;
alter table clients add column if not exists insurance_payer_id   text;  -- Stedi tradingPartnerServiceId
alter table clients add column if not exists insurance_payer_name text;
alter table clients add column if not exists insurance_member_id  text;

-- One row per eligibility check. Doubles as the audit trail (who checked, when,
-- and the full 271 payload) until a dedicated audit_log lands in Phase 0.
create table if not exists eligibility_checks (
  id                   uuid        primary key default gen_random_uuid(),
  organization_id      uuid        not null references organizations(id) on delete cascade,
  client_id            uuid        not null references clients(id) on delete cascade,
  status               text        not null check (status in ('active','inactive','error')),
  plan_name            text,
  payer_name           text,
  copay                numeric(10,2),
  coinsurance          numeric(5,2),   -- percent, 0–100
  deductible           numeric(10,2),
  deductible_remaining numeric(10,2),
  raw                  jsonb,          -- full 271 response, for audit/debug
  error                text,
  checked_by           uuid        references auth.users(id) on delete set null,
  checked_at           timestamptz not null default now()
);

create index if not exists eligibility_checks_client_idx
  on eligibility_checks(organization_id, client_id, checked_at desc);

alter table eligibility_checks enable row level security;

create policy "org_members_eligibility_checks" on eligibility_checks for all
  using  (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));
