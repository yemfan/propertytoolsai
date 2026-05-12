-- Tracks each Generate-Leads social post that we published on
-- behalf of an agent. One row per (caption, platform target).
--
-- Phase 2A.2 inserts rows synchronously after a successful Meta
-- Graph API call. Phase 2A.4 (later) refreshes `metrics` from
-- /{post-id}/insights periodically. Phase 2B (Lead Ads) reuses
-- this table for ad creative posts when applicable.
--
-- agents.id is bigint; social_accounts.id is uuid; media_library.id
-- is uuid (all confirmed against prod 2026-05-12).

create table if not exists public.lead_posts (
  id uuid primary key default gen_random_uuid(),
  agent_id bigint not null references public.agents (id) on delete cascade,
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,

  -- 'facebook' = Facebook Page feed
  -- 'instagram' = Instagram Business via the same Page connection
  -- Kept narrow for Phase 2A; expands to 'linkedin'|'x' in Phase 3.
  platform text not null
    check (platform in ('facebook', 'instagram')),

  -- The actual caption as posted (may differ from the AI's first
  -- draft if the agent edited before clicking Publish).
  caption text not null,
  hashtags text[] not null default array[]::text[],

  -- Optional image. media_url_used is the signed URL we handed to
  -- Meta at publish time — kept for forensic / "why did Meta
  -- reject this?" debugging since signed URLs expire and the live
  -- media_library row can be deleted.
  media_library_id uuid references public.media_library (id) on delete set null,
  media_url_used text,

  -- Attribution context — which wizard trigger drove this post.
  -- Free-text on purpose: this is for analytics, not for app logic,
  -- and trigger names are stable across phases.
  trigger_kind text,
  subject_kind text,
  subject_ref_id text,

  -- Meta-side identifiers, populated on successful publish.
  external_post_id text,
  external_post_url text,

  status text not null default 'pending'
    check (status in ('pending', 'published', 'failed')),
  error_message text,

  -- Engagement counters (likes / comments / shares / reach). Empty
  -- object until Phase 2A.4 backfills via /insights. Keeping
  -- JSONB instead of typed columns because the field set varies
  -- per platform (IG has saves; FB has shares; eventually we may
  -- want reach/impressions/clicks too).
  metrics jsonb not null default '{}'::jsonb,
  metrics_refreshed_at timestamptz,

  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Most reads are "show me this agent's posts, newest first" for the
-- performance / history surface.
create index if not exists lead_posts_agent_idx
  on public.lead_posts (agent_id, created_at desc);

-- Status-filtered reads for the engagement-refresh job + retries on
-- failed posts.
create index if not exists lead_posts_status_idx
  on public.lead_posts (status, created_at desc);

-- Lookup by external_post_id for webhook callbacks (Phase 2B for
-- Lead-Ad lead retrieval; eventually for IG comment webhooks).
create index if not exists lead_posts_external_id_idx
  on public.lead_posts (external_post_id)
  where external_post_id is not null;

comment on table public.lead_posts is
  'Each social post we published via the Generate Leads feature. Status tracking + metrics live here; the caption + image are denormalized so the row survives media_library cleanup.';
