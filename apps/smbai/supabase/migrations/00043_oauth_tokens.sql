-- ============================================================
-- Migration 00043: Per-org OAuth tokens (Google Calendar, extensible)
-- ============================================================
-- Stores third-party OAuth tokens per org + provider. First consumer is
-- Google Calendar (appointment booking + free/busy availability).
-- Tokens are RLS-scoped to org members; server logic reads via service role.
-- (Encrypting tokens at rest is a future hardening step.)
-- ============================================================

create table if not exists org_oauth_tokens (
  id               uuid        primary key default gen_random_uuid(),
  organization_id  uuid        not null references organizations(id) on delete cascade,
  provider         text        not null,            -- 'google'
  access_token     text        not null,
  refresh_token    text,
  token_type       text        not null default 'Bearer',
  expires_at       timestamptz,
  scope            text,
  account_email    text,                            -- the connected Google account
  connected_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, provider)
);

create index if not exists org_oauth_tokens_org_idx on org_oauth_tokens(organization_id);

alter table org_oauth_tokens enable row level security;

create policy "org_members_oauth_tokens" on org_oauth_tokens
  for all
  using  (organization_id in (select get_user_org_ids()))
  with check (organization_id in (select get_user_org_ids()));

create trigger set_updated_at_org_oauth_tokens
  before update on org_oauth_tokens
  for each row execute function set_updated_at();
