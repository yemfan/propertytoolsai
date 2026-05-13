-- LinkedIn organic-posting support for Generate Leads.
--
-- LinkedIn's Share API (the `w_member_social` OAuth scope, not the
-- approval-gated Marketing API) lets us post on behalf of the agent
-- as themselves to their personal feed. We don't pursue Company
-- Page posting here — that needs the Marketing API which is
-- partner-program-gated. Personal-feed organic is what the agent
-- track was always going to look like for LinkedIn.
--
-- Three schema changes:
--   1. social_accounts gains LinkedIn-specific columns (member URN +
--      email) and a unique index per (agent_id, platform, member URN)
--   2. lead_posts.platform check constraint widens to include 'linkedin'
--   3. scheduled_posts.platform check constraint widens to include 'linkedin'

-- ── 1. social_accounts: LinkedIn columns ─────────────────────────────

alter table public.social_accounts
  add column if not exists linkedin_member_urn text,
  add column if not exists linkedin_member_email text;

-- One connection per (agent_id, platform, member URN) — re-connecting
-- the same LinkedIn member upserts instead of duplicating.
create unique index if not exists social_accounts_linkedin_unique
  on public.social_accounts (agent_id, platform, linkedin_member_urn)
  where linkedin_member_urn is not null;

-- ── 2. lead_posts: widen platform ────────────────────────────────────

alter table public.lead_posts
  drop constraint if exists lead_posts_platform_check;

alter table public.lead_posts
  add constraint lead_posts_platform_check
    check (platform in ('facebook', 'instagram', 'linkedin'));

-- ── 3. scheduled_posts: widen platform ───────────────────────────────

alter table public.scheduled_posts
  drop constraint if exists scheduled_posts_platform_check;

alter table public.scheduled_posts
  add constraint scheduled_posts_platform_check
    check (platform in ('facebook', 'instagram', 'linkedin'));

comment on column public.social_accounts.linkedin_member_urn is
  'urn:li:person:<id> — used as the `author` field on LinkedIn share API posts.';
