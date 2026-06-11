-- Theme constitution, notifications rule: notify only on revenue
-- opportunity, transaction risk, human action required, or urgent
-- deadline. Post-engagement-milestone pushes are celebration-style
-- marketing noise, so they become OPT-IN. Existing explicit rows are
-- left untouched; new agents (and agents with no prefs row, via the
-- code-side default) no longer receive them unless they turn them on.

alter table public.agent_notification_preferences
  alter column push_post_milestone set default false;

comment on column public.agent_notification_preferences.push_post_milestone is
  'Opt-IN (default false per the notification philosophy): push as posts cross 1/10/50/100/250/500/1000 total engagement. Inbox row is still written either way.';
