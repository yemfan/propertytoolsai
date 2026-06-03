-- ----------------------------------------------------------------------------
-- Drift reconciliation (repo-first): this DDL was applied to the Core / HelmSmart
-- Supabase project (vpmwsnoosuiknyzdxgtk) out-of-band and was never committed to
-- this migrations folder. It is committed here so a from-scratch replay of
-- apps/helmsmart-web/supabase/migrations/* reproduces Core's actual public schema.
-- Core schema_migrations name: "outbound_call_queue"
-- Source (verbatim): supabase/migrations/00051_outbound_call_queue.sql
-- NOTE: This CREATE TABLE must precede 00059_outbound_queue_detail.sql (the ALTER
-- that adds outbound_call_queue.detail, formerly numbered 00046) and
-- 00058_voice_appointment_reminders.sql (which adds event_id). See PR for details.
-- This commit changes no database.
-- ----------------------------------------------------------------------------

-- Bulk outbound calling. "Call all" enqueues contacts here; a background drain
-- (triggered right after enqueue) dials them staggered + within calling hours,
-- so we never ring a whole list at once or exceed Retell concurrency.

create table if not exists outbound_call_queue (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations(id) on delete cascade,
  client_id       uuid        not null references clients(id) on delete cascade,
  purpose         text        not null,
  status          text        not null default 'queued'
                              check (status in ('queued', 'calling', 'done', 'failed')),
  attempts        int         not null default 0,
  last_error      text,
  call_sid        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_outbound_queue_org_status
  on outbound_call_queue(organization_id, status, created_at);

-- One pending call per contact+purpose at a time (prevents double-queuing on
-- repeated "Call all" clicks; a backstop for the in-app dedup check).
create unique index if not exists uniq_outbound_queue_pending
  on outbound_call_queue(organization_id, client_id, purpose)
  where status in ('queued', 'calling');

alter table outbound_call_queue enable row level security;

create policy "members_select_outbound_queue" on outbound_call_queue
  for select using (organization_id in (select get_user_org_ids()));
