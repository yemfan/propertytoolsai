-- Inbound email deliveries (Phase 2)
--
-- One row per email Resend Inbound delivers to one of our agent
-- aliases. Phase 1 only created a task; Phase 2 also stores the raw
-- delivery + a structured extraction (price / parties / dates) so the
-- agent can act on it without retyping. The task created in Phase 1
-- now links to a review page driven by this row.
--
-- Attachments are NOT downloaded into Storage at this stage — Resend
-- gives us a signed URL that's valid long enough for the extractor to
-- fetch on demand. If we ever need a permanent copy we can copy it
-- into Supabase Storage from the review page.

create table if not exists public.inbound_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  alias_id uuid not null references public.agent_inbound_aliases(id) on delete cascade,
  -- bigint matches public.agents(id) — see note in the
  -- agent_inbound_aliases migration.
  agent_id bigint not null references public.agents(id) on delete cascade,
  -- Backref to the "Review forwarded …" task on `crm_tasks` (legacy
  -- name `tasks` doesn't exist in this codebase). Set on insert; null
  -- only if task creation failed (rare — webhook returns 500 +
  -- retries in that case, so orphans shouldn't accumulate).
  task_id uuid references public.crm_tasks(id) on delete set null,
  -- Resend's `data.id` — useful for log correlation and to dedupe if
  -- Resend ever retries an `email.received` event. We don't enforce
  -- uniqueness because Resend already dedupes on their side and the
  -- Svix layer protects against straight replay.
  resend_message_id text,
  intent text not null check (
    intent in ('offer_received', 'listing_signed', 'showing_requested', 'unknown')
  ),
  -- Raw email envelope fields. Stored for the review page so the agent
  -- can confirm we routed the right email even before extraction runs.
  from_header text,
  to_header text,
  subject text,
  text_preview text, -- first ~2000 chars of the body
  -- Attachments as Resend hands them to us:
  --   [{ filename, content_type, content_url }]
  attachments_json jsonb,
  -- Extraction lifecycle:
  --   'pending'   — webhook stored the delivery; extractor not yet run
  --                 (e.g. unknown intent, or no PDF attached)
  --   'extracted' — extractor ran successfully, `extraction` populated
  --   'failed'    — extractor errored; review page shows a "Retry" button
  --   'skipped'   — intent doesn't have an extractor (showing_requested
  --                 currently has no structured extractor; we still
  --                 surface the email body for the agent)
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'extracted', 'failed', 'skipped')),
  -- ParsedOffer for offer_received, ListingAgreementExtraction for
  -- listing_signed. Shape policed application-side, not via JSON Schema
  -- (Postgres JSON Schema check constraints are heavy and the shape
  -- changes faster than migrations).
  extraction jsonb,
  extraction_error text,
  extracted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists inbound_email_deliveries_agent_id_idx
  on public.inbound_email_deliveries (agent_id, created_at desc);

create index if not exists inbound_email_deliveries_alias_id_idx
  on public.inbound_email_deliveries (alias_id);

-- Quick lookup when the review page or "retry extraction" surface
-- needs to find pending/failed deliveries that the agent might want
-- to act on.
create index if not exists inbound_email_deliveries_status_idx
  on public.inbound_email_deliveries (agent_id, extraction_status)
  where extraction_status in ('pending', 'failed');
