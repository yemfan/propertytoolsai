-- Google Calendar sync for showings.
--
-- Stores the Google Calendar event id so we can update / delete the
-- remote event when an agent changes a showing locally. Null means
-- either the agent hasn't connected Google Calendar yet, the sync
-- failed gracefully (we don't crash the primary write for a calendar
-- issue), or the showing is from before the sync feature.
--
-- We deliberately do NOT reuse `lead_calendar_events` for showings.
-- That table is scoped to lead-level events (meetings from the
-- reminder system) and carries FK + triggers specific to that flow.
-- Showings are lifecycle-adjacent (pre-contract visits) and belong
-- with the showings row.

alter table public.showings
  add column if not exists google_event_id text;

comment on column public.showings.google_event_id is
  'Google Calendar event id returned by Google when we synced this showing. Null = never synced or sync failed. See lib/google-calendar/sync.ts.';
