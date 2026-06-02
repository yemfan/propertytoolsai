-- Free-text context for a queued outbound AI call: the survey questions or the
-- promo/announcement message the agent should deliver. appointment_reminder
-- still derives its detail from event_id (the appointment time) at dial time, so
-- this column is only populated for survey / promo purposes.

alter table public.outbound_call_queue
  add column if not exists detail text;

comment on column public.outbound_call_queue.detail is
  'Survey questions / promo message for the AI call (purposes survey & promo).';
