-- Per-agent connections to social-media platforms (OAuth).
--
-- Phase 2A introduces this for Meta (Facebook Page + linked Instagram
-- Business). The `platform` discriminator is constrained to a wider
-- set than we currently use so Phase 3 (LinkedIn, X, Google) can add
-- rows without an enum migration.
--
-- Tokens are stored in encrypted form (AES-256-GCM, app-level
-- encryption with the SOCIAL_TOKEN_ENC_KEY env var). Service-role
-- access only — the table is never exposed to anon/authenticated
-- supabase clients. See lib/leads-gen/token-enc.ts for the codec.
--
-- agents.id is bigint (confirmed via pg_attribute on prod 2026-05-12).

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents (id) on delete cascade,

  -- Generic platform discriminator. Phase 2A: only 'meta' is in use.
  -- Reserved values for future use so we don't have to ALTER the
  -- check constraint when each new platform lands.
  platform text not null
    check (platform in ('meta', 'linkedin', 'x', 'google')),

  -- Display identity (works for any platform). Used in the
  -- connection-management UI as the agent-facing label.
  account_display_name text,
  account_picture_url text,

  -- Meta-specific identity. Nullable so future platform rows can
  -- leave them blank. The unique index below uses fb_page_id when
  -- present so an agent can't double-connect the same Page.
  fb_page_id text,
  fb_page_name text,
  ig_business_user_id text,
  ig_business_username text,

  -- Encrypted tokens. Format: "<iv>.<auth_tag>.<ciphertext>" all
  -- base64. AES-256-GCM, key from SOCIAL_TOKEN_ENC_KEY.
  --
  -- For Meta: Page tokens are technically non-expiring once minted
  -- from a long-lived user token, but Meta can revoke at any time
  -- (e.g. password change, user removes the app). user_access_token
  -- is kept for re-mint if a Page token starts returning OAuth
  -- errors.
  page_access_token_enc text,
  user_access_token_enc text,
  user_token_expires_at timestamptz,

  scopes text[] not null default array[]::text[],

  status text not null default 'connected'
    check (status in ('connected', 'expired', 'revoked', 'error')),
  last_error text,

  connected_at timestamptz not null default now(),
  last_refreshed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- One connection per (agent, platform, fb_page_id) — re-connecting
-- an already-connected Page updates the existing row instead of
-- creating a duplicate (handled by the callback via upsert).
create unique index if not exists social_accounts_meta_unique
  on public.social_accounts (agent_id, platform, fb_page_id)
  where fb_page_id is not null;

-- Most reads are "give me this agent's accounts, newest first".
create index if not exists social_accounts_agent_id_idx
  on public.social_accounts (agent_id, status, connected_at desc);

comment on table public.social_accounts is
  'Per-agent OAuth connections to social-media platforms (Meta + future LinkedIn/X/Google). Tokens AES-256-GCM encrypted at rest.';
