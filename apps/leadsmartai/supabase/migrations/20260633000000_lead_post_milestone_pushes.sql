-- Engagement-milestone push tracking + opt-out preference.
--
-- The /api/cron/refresh-post-metrics cron computes a total
-- engagement score after each refresh and compares against the
-- last threshold we've already pushed for. When a milestone is
-- crossed (1 / 10 / 50 / 100 / 250 / 500 / 1000), it dispatches
-- a push notification to the agent and bumps the high-water mark
-- so we don't keep re-firing on subsequent refreshes.
--
-- Defaulting `push_post_milestone` to true matches the existing
-- behavior of push_hot_lead / push_missed_call / push_reminder —
-- new agents get the pings, and they can mute via the
-- notification-preferences screen if it's noise.

-- ── lead_posts: engagement-milestone high-water mark ────────────

alter table public.lead_posts
  add column if not exists last_milestone_pushed integer not null default 0;

comment on column public.lead_posts.last_milestone_pushed is
  'Highest engagement-milestone threshold (likes+comments+shares+saves) we have already pushed an alert for. Prevents duplicate pushes when the refresh cron stays above a threshold across runs.';

-- The cron picks rows by (status, metrics_refreshed_at) — we don't
-- need a dedicated index on the new column because reads always
-- come through the existing lead_posts_agent_idx / lead_posts_status_idx
-- paths.

-- ── agent_notification_preferences: per-agent opt-out flag ──────

alter table public.agent_notification_preferences
  add column if not exists push_post_milestone boolean not null default true;

comment on column public.agent_notification_preferences.push_post_milestone is
  'When true, the post-engagement-milestone cron sends a push as posts cross 1/10/50/100/250/500/1000 total engagement. Inbox row is still written either way for in-app surfacing.';
