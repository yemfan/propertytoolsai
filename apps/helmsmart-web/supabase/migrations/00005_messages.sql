-- 00005_messages.sql
-- Inbox (email + SMS threads) and Reception (call log) tables.
-- All rows are org-scoped with RLS via get_user_org_ids().

-- ─── Messages ────────────────────────────────────────────────────────────────

create table if not exists messages (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations(id) on delete cascade,
  client_id       uuid        references clients(id) on delete set null,

  channel         text        not null check (channel in ('email', 'sms')),
  direction       text        not null check (direction in ('inbound', 'outbound')),

  from_address    text,
  to_address      text,
  subject         text,                       -- email only
  body            text        not null,

  read            boolean     not null default false,
  external_id     text,                       -- Resend messageId or Twilio SID

  sent_at         timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists idx_messages_org_client
  on messages(organization_id, client_id, sent_at desc);

create index if not exists idx_messages_org_unread
  on messages(organization_id, read) where not read;

alter table messages enable row level security;

create policy "members_select_messages" on messages
  for select using (organization_id in (select get_user_org_ids()));

create policy "members_insert_messages" on messages
  for insert with check (organization_id in (select get_user_org_ids()));

create policy "members_update_messages" on messages
  for update using (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));

-- ─── Calls ───────────────────────────────────────────────────────────────────

create table if not exists calls (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations(id) on delete cascade,
  client_id       uuid        references clients(id) on delete set null,

  from_number     text        not null,
  to_number       text        not null,
  status          text        not null check (status in ('missed', 'answered', 'voicemail')),
  duration_seconds int,
  twilio_call_sid text        unique,

  auto_replied    boolean     not null default false,
  reply_body      text,

  called_at       timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists idx_calls_org_called_at
  on calls(organization_id, called_at desc);

alter table calls enable row level security;

create policy "members_select_calls" on calls
  for select using (organization_id in (select get_user_org_ids()));

create policy "members_insert_calls" on calls
  for insert with check (organization_id in (select get_user_org_ids()));

-- ─── Org settings extras ─────────────────────────────────────────────────────
-- Add Twilio phone number + auto-reply toggle to organizations table.

alter table organizations
  add column if not exists twilio_number    text,
  add column if not exists auto_reply       boolean not null default false,
  add column if not exists auto_reply_msg   text    not null default
    'Hey! We missed your call. We''ll get back to you shortly — reply here if you''d like to chat!';
