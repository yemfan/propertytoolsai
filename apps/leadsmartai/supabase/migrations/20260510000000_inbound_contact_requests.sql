-- Audit table for public-form contact requests + SMS opt-in records.
--
-- Backs the consent record TCPA expects: every public submission that
-- ticks the SMS opt-in checkbox produces a row here pinned to the EXACT
-- disclosure text shown at submit time, the timestamp, the IP, and the
-- user agent. If a regulator or carrier asks "show me proof this number
-- consented to your messages on date X," the row + the
-- `consent_disclosure_version` is the answer.
--
-- The /contact form (PR #168) is the first writer; future public forms
-- (open-house signin, IDX lead-capture) should write here too as their
-- own follow-up PRs land. The `source` column distinguishes them.
--
-- RLS posture:
--   - Service-role inserts (server-side, via supabaseAdmin). The form
--     route is the only writer.
--   - No public SELECT policies — audit data is sensitive (IP address,
--     full message body). Admin-only reads via service role; an agent
--     dashboard could grow a per-tenant view later if needed.

create table if not exists public.inbound_contact_requests (
  id uuid primary key default gen_random_uuid(),

  -- Where the submission came from. Stable identifier — keep it short
  -- and machine-friendly so it's easy to filter on.
  source text not null,

  -- Submitted fields. All optional except source — different forms
  -- collect different combinations.
  name text,
  email text,
  phone text,
  subject text,
  message text,

  -- Consent flags. sms_consent is the load-bearing one for TCPA;
  -- email_consent is captured when a form has a separate checkbox
  -- (today the /contact form doesn't, so it's null there).
  sms_consent boolean not null default false,
  email_consent boolean,

  -- Identifies the EXACT disclosure copy that was on screen at submit.
  -- Bump the version whenever the disclosure text changes materially.
  -- Stored here (not derived) so we can prove what the consenting party
  -- saw even if the live form has since been edited.
  consent_disclosure_version text,

  -- Audit metadata.
  ip_address text,
  user_agent text,

  -- Optional link to a CRM contact that was created/matched from this
  -- submission. Null when no contact was created (e.g. the /contact
  -- form's email-only intake today). Set when a future PR wires the
  -- public form to upsert into contacts.
  contact_id uuid references public.contacts(id) on delete set null,

  created_at timestamptz not null default now()
);

comment on table public.inbound_contact_requests is
  'Public-form submissions + SMS/email consent audit. TCPA-required record of who consented to receive messages, when, and what disclosure they saw. Service-role writes only.';

comment on column public.inbound_contact_requests.source is
  'Stable identifier for the form that produced this row. Examples: "/contact", "/oh/<slug>", "/api/idx/lead-capture".';

comment on column public.inbound_contact_requests.consent_disclosure_version is
  'Version tag for the exact disclosure text shown at submit. Bump when the disclosure changes materially. The current /contact form ships v1.0_2026-04-27.';

-- Lookup patterns:
--   1. "Has this phone number ever consented?" — index on phone where consent=true
--   2. "Show me the audit trail for this email" — index on email
--   3. "Pull all submissions in a date range" — index on created_at
create index if not exists idx_inbound_contact_requests_phone_consent
  on public.inbound_contact_requests (phone)
  where sms_consent = true;

create index if not exists idx_inbound_contact_requests_email
  on public.inbound_contact_requests (email);

create index if not exists idx_inbound_contact_requests_created_at
  on public.inbound_contact_requests (created_at desc);

-- ── RLS — admin-only by default (no public SELECT policies) ──────

alter table public.inbound_contact_requests enable row level security;

-- The form route uses supabaseAdmin (service role bypasses RLS for
-- writes). No anon-key INSERT policy is needed; deliberately omitting
-- one keeps the audit table immune from client-side tampering even if
-- the anon key leaks.
