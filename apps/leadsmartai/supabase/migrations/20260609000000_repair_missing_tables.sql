-- Consolidated repair for the 10 tables the application code expects
-- but that never landed in prod. Originally split across the
-- 20260429* "lead_enrichment_runs", "lead_duplicate_candidates",
-- "deferred_tables_catchup" migrations whose schema_migrations rows
-- exist but whose DDL partially failed and rolled back.
--
-- Idempotent: every statement is `IF NOT EXISTS` (or its
-- DO-block equivalent for ADD CONSTRAINT). Safe to re-run.
--
-- After this lands:
--   * /dashboard/inbox picks up email rows alongside SMS.
--   * /dashboard/drafts review queue starts populating from cron.
--   * /dashboard/drafts/activity audit feed starts populating.
--   * Enrichment, leadsmart, and pricing runs gain audit trails.
--   * Client portal chat + saved homes + documents become writable.
--
-- The defensive try/catches added in #281, #286, #287 stay in place
-- as belt-and-suspenders — if a future drift recurs, the code still
-- degrades gracefully.

-- ── lead_enrichment_runs — enrichment pipeline audit log ────────────
create table if not exists public.lead_enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  run_type text not null check (run_type in ('cleanup', 'enrichment', 'merge')),
  status text not null default 'completed',
  changes_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_lead_enrichment_runs_contact_created
  on public.lead_enrichment_runs(contact_id, created_at desc);
alter table public.lead_enrichment_runs enable row level security;
drop policy if exists "lead_enrichment_runs_select_own" on public.lead_enrichment_runs;
create policy "lead_enrichment_runs_select_own" on public.lead_enrichment_runs
  for select using (
    exists (
      select 1 from public.contacts c
      join public.agents a on a.id = c.agent_id
      where c.id = lead_enrichment_runs.contact_id
        and a.auth_user_id = auth.uid()
    )
  );
comment on table public.lead_enrichment_runs is
  'Audit log for the contact enrichment pipeline (cleanup, enrichment, merge runs).';

-- ── lead_duplicate_candidates — pending dedup pairs ────────────────
create table if not exists public.lead_duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  primary_contact_id uuid not null references public.contacts(id) on delete cascade,
  duplicate_contact_id uuid not null references public.contacts(id) on delete cascade,
  confidence_score integer not null,
  reason_json jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'merged', 'ignored')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (primary_contact_id, duplicate_contact_id),
  check (primary_contact_id <> duplicate_contact_id)
);
create index if not exists idx_duplicate_candidates_status
  on public.lead_duplicate_candidates(status, confidence_score desc);
create index if not exists idx_duplicate_candidates_primary
  on public.lead_duplicate_candidates(primary_contact_id);
alter table public.lead_duplicate_candidates enable row level security;
drop policy if exists "ldc_select_own" on public.lead_duplicate_candidates;
create policy "ldc_select_own" on public.lead_duplicate_candidates
  for select using (
    exists (
      select 1 from public.contacts c
      join public.agents a on a.id = c.agent_id
      where c.id = lead_duplicate_candidates.primary_contact_id
        and a.auth_user_id = auth.uid()
    )
  );
comment on table public.lead_duplicate_candidates is
  'Pending duplicate-contact pairs surfaced by the dedup pipeline.';

-- ── leadsmart_runs — LeadSmart AI scoring audit ────────────────────
create table if not exists public.leadsmart_runs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  status text not null default 'success' check (status in ('success', 'error')),
  model text,
  score numeric(8,2),
  intent text,
  timeline text,
  confidence numeric(8,4),
  explanation jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  latency_ms int,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_leadsmart_runs_contact_created
  on public.leadsmart_runs(contact_id, created_at desc);
create index if not exists idx_leadsmart_runs_status_created
  on public.leadsmart_runs(status, created_at desc);
alter table public.leadsmart_runs enable row level security;
drop policy if exists "leadsmart_runs_select_own" on public.leadsmart_runs;
create policy "leadsmart_runs_select_own" on public.leadsmart_runs
  for select using (
    exists (
      select 1 from public.contacts c
      join public.agents a on a.id = c.agent_id
      where c.id = leadsmart_runs.contact_id
        and a.auth_user_id = auth.uid()
    )
  );
comment on table public.leadsmart_runs is
  'Per-contact LeadSmart AI scoring runs (intent, timeline, confidence).';

-- ── lead_pricing_predictions — pricing engine outputs ──────────────
create table if not exists public.lead_pricing_predictions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.opportunities(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  property_address text,
  city text,
  state text,
  model_version text not null default 'v1',
  behavior_score numeric(8,2) not null default 0,
  engagement_score numeric(8,2) not null default 0,
  profile_score numeric(8,2) not null default 0,
  market_score numeric(8,2) not null default 0,
  lead_score numeric(8,2) not null default 0,
  score_multiplier numeric(8,4) not null default 1,
  demand_multiplier numeric(8,4) not null default 1,
  price_credits int not null default 0,
  commission_value numeric(12,2) not null default 0,
  close_probability numeric(8,4) not null default 0,
  expected_revenue numeric(12,2) not null default 0,
  explanation text not null default '',
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_lead_pricing_predictions_created
  on public.lead_pricing_predictions(created_at desc);
create index if not exists idx_lead_pricing_predictions_opportunity
  on public.lead_pricing_predictions(opportunity_id, created_at desc)
  where opportunity_id is not null;
create index if not exists idx_lead_pricing_predictions_contact
  on public.lead_pricing_predictions(contact_id, created_at desc)
  where contact_id is not null;
comment on table public.lead_pricing_predictions is
  'Snapshots of the lead pricing engine output (per opportunity / contact).';

-- ── client_portal_messages — client ↔ agent chat ───────────────────
create table if not exists public.client_portal_messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  sender_role text not null check (sender_role in ('client', 'agent')),
  sender_auth_user_id uuid,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_client_portal_messages_contact_created
  on public.client_portal_messages(contact_id, created_at asc);
alter table public.client_portal_messages enable row level security;
drop policy if exists "client_portal_messages_select_own" on public.client_portal_messages;
create policy "client_portal_messages_select_own" on public.client_portal_messages
  for select using (
    exists (
      select 1 from public.contacts c
      join public.agents a on a.id = c.agent_id
      where c.id = client_portal_messages.contact_id
        and a.auth_user_id = auth.uid()
    )
  );
comment on table public.client_portal_messages is
  'Client portal chat thread between a contact and their agent.';

-- ── client_saved_homes — mobile favorites ──────────────────────────
create table if not exists public.client_saved_homes (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  contact_id uuid references public.contacts(id) on delete set null,
  address text not null,
  ai_score int,
  insights jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_client_saved_homes_user
  on public.client_saved_homes(auth_user_id, updated_at desc);
alter table public.client_saved_homes enable row level security;
drop policy if exists "client_saved_homes_select_own" on public.client_saved_homes;
create policy "client_saved_homes_select_own" on public.client_saved_homes
  for select using (auth_user_id = auth.uid());
drop policy if exists "client_saved_homes_modify_own" on public.client_saved_homes;
create policy "client_saved_homes_modify_own" on public.client_saved_homes
  for all using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());
comment on table public.client_saved_homes is
  'Mobile-app saved homes (favorites) per authenticated client user.';

-- ── client_portal_documents — per-contact published docs ──────────
create table if not exists public.client_portal_documents (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  title text not null,
  doc_type text not null default 'file' check (doc_type in ('file', 'link', 'report')),
  url text,
  storage_path text,
  created_at timestamptz not null default now()
);
create index if not exists idx_client_portal_documents_contact
  on public.client_portal_documents(contact_id, created_at desc);
alter table public.client_portal_documents enable row level security;
drop policy if exists "client_portal_documents_select_own" on public.client_portal_documents;
create policy "client_portal_documents_select_own" on public.client_portal_documents
  for select using (
    exists (
      select 1 from public.contacts c
      join public.agents a on a.id = c.agent_id
      where c.id = client_portal_documents.contact_id
        and a.auth_user_id = auth.uid()
    )
  );
comment on table public.client_portal_documents is
  'Agent-published documents visible to the contact in the client portal.';

-- ── email_messages — symmetric to sms_messages but for email ───────
create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  agent_id bigint references public.agents(id) on delete set null,
  subject text,
  message text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  external_message_id text,
  email_status text,
  created_at timestamptz not null default now()
);
create index if not exists idx_email_messages_contact_created
  on public.email_messages(contact_id, created_at desc);
create index if not exists idx_email_messages_agent_created
  on public.email_messages(agent_id, created_at desc)
  where agent_id is not null;
alter table public.email_messages enable row level security;
drop policy if exists "email_messages_select_own" on public.email_messages;
create policy "email_messages_select_own" on public.email_messages
  for select using (
    exists (
      select 1 from public.contacts c
      join public.agents a on a.id = c.agent_id
      where c.id = email_messages.contact_id
        and a.auth_user_id = auth.uid()
    )
  );
comment on table public.email_messages is
  'Per-contact email thread. Mirrors sms_messages so the inbox aggregator can union both channels.';

-- ── message_drafts — Review-mode approval queue ────────────────────
create table if not exists public.message_drafts (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  -- text rather than uuid to match templates.id (FK declared further down to avoid ordering)
  template_id text references public.templates(id) on delete set null,
  channel text not null check (channel in ('sms', 'email')),
  subject text,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'sent', 'failed')),
  trigger_context jsonb not null default '{}'::jsonb,
  edited boolean not null default false,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejected_reason text,
  sent_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  scheduled_for timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_message_drafts_agent_status_created
  on public.message_drafts(agent_id, status, created_at desc);
create index if not exists idx_message_drafts_contact_created
  on public.message_drafts(contact_id, created_at desc);
alter table public.message_drafts enable row level security;
drop policy if exists "message_drafts_select_own" on public.message_drafts;
create policy "message_drafts_select_own" on public.message_drafts
  for select using (
    exists (
      select 1 from public.agents a
      where a.id = message_drafts.agent_id
        and a.auth_user_id = auth.uid()
    )
  );
comment on table public.message_drafts is
  'Approval queue for AI-generated outbound messages (Review-mode flow).';

-- ── trigger_firings — scheduler audit per (contact × template) eval ─
-- templates.id is text in prod (not uuid), so trigger_firings.template_id
-- mirrors the parent column type. message_drafts.template_id likewise.
create table if not exists public.trigger_firings (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  template_id text references public.templates(id) on delete set null,
  period_key text not null,
  draft_id uuid references public.message_drafts(id) on delete set null,
  suppressed_reason text,
  trigger_context jsonb not null default '{}'::jsonb,
  fired_at timestamptz not null default now()
);
create index if not exists idx_trigger_firings_agent_fired
  on public.trigger_firings(agent_id, fired_at desc);
create index if not exists idx_trigger_firings_contact_fired
  on public.trigger_firings(contact_id, fired_at desc);
alter table public.trigger_firings enable row level security;
drop policy if exists "trigger_firings_select_own" on public.trigger_firings;
create policy "trigger_firings_select_own" on public.trigger_firings
  for select using (
    exists (
      select 1 from public.agents a
      where a.id = trigger_firings.agent_id
        and a.auth_user_id = auth.uid()
    )
  );
comment on table public.trigger_firings is
  'Per (contact × template) scheduler evaluation outcome — created or suppressed.';
