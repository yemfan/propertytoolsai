-- Stop the morning briefing job from flagging brand-new contacts
-- as "999 days inactive."
--
-- Root cause: dailyBriefing.daysSince() returns 999 as a sentinel
-- when contacts.last_activity_at is null. The column has no DB
-- default, so most contact-creation paths (dashboard form, lead
-- intake, imports, cron syncers) leave it NULL on insert. Result:
-- the very first morning after onboarding, the agent gets
-- "Follow up with inactive lead" tasks for every contact they
-- just added, with memos reading "Lead has been inactive for
-- 999 days at <address>" — confusing AND wrong.
--
-- Two changes here:
--
--   1. Default `contacts.last_activity_at` to now() so future
--      inserts get the create time as the baseline activity
--      timestamp. The column stays nullable so legacy code that
--      explicitly sets it to null still works.
--
--   2. Backfill existing NULL rows. Coalesce in order of
--      decreasing freshness so we use the most recent signal we
--      have for each row:
--         last_contacted_at  (explicit "I called/emailed them")
--         updated_at         (some field was edited)
--         created_at         (when the row was first inserted)
--         now()              (fallback for the truly weird case)
--
-- After this lands, brand-new contacts will be 0-day-old, not
-- 999-day-old. Existing contacts inherit a sensible-ish baseline
-- so the briefing job stops re-flagging them every morning.
-- Future activity tracking (SMS / email / showings updating
-- last_activity_at) is a separate piece of work — flagged but
-- not blocking this fix.

alter table public.contacts
  alter column last_activity_at set default now();

update public.contacts
set last_activity_at = coalesce(last_contacted_at, updated_at, created_at, now())
where last_activity_at is null;
