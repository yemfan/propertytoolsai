-- ----------------------------------------------------------------------------
-- Drift reconciliation: renumbered from 00046 -> 00059. This ALTER adds a column
-- to outbound_call_queue, whose CREATE TABLE was applied to Core out-of-band and
-- is now committed as 00056_outbound_call_queue.sql. Previously this folder had
-- NO migration that created outbound_call_queue, so a from-scratch replay failed
-- here; moving this ALTER after 00056 makes the replay create the table first.
-- The column itself already exists in Core (applied out-of-band). No DB change.
-- ----------------------------------------------------------------------------

-- Free-text context for a queued outbound AI call: the survey questions or the
-- promo/announcement message the agent should deliver. appointment_reminder
-- still derives its detail from event_id (the appointment time) at dial time, so
-- this column is only populated for survey / promo purposes.

alter table public.outbound_call_queue
  add column if not exists detail text;

comment on column public.outbound_call_queue.detail is
  'Survey questions / promo message for the AI call (purposes survey & promo).';
