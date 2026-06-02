-- Per-agent office hours for the AI receptionist: drives the bookable window
-- (appointment slots) and the hours shown in the prompt. Stored as
-- {mon:{open,close}|null, ... sun}, 24h "HH:MM". Null column = the engine
-- default (Mon–Fri 9 AM–5 PM).
alter table public.voice_receptionist_settings
  add column if not exists business_hours jsonb;

comment on column public.voice_receptionist_settings.business_hours is
  'Per-agent business hours: {mon:{open,close}|null, ... sun} in 24h HH:MM. Null = default Mon-Fri 9-5. Used for booking availability + prompt hours.';
