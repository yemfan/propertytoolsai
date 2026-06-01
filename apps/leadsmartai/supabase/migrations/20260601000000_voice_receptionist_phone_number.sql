-- Multi-tenant receptionist routing: the phone number a receptionist config
-- answers on. The Retell inbound webhook resolves the dialed number (to_number)
-- to the owning agent via this column, so any realtor's number reaches their own
-- receptionist — no env map, no hardcoded number->agent mapping.
--
-- Idempotent. Apply with:
--   node ./scripts/apply-supabase-sql-remote.mjs supabase/migrations/20260601000000_voice_receptionist_phone_number.sql
-- (or paste this into Supabase -> SQL Editor.)

ALTER TABLE public.voice_receptionist_settings
  ADD COLUMN IF NOT EXISTS phone_number text;

-- One receptionist number maps to exactly one agent.
CREATE UNIQUE INDEX IF NOT EXISTS voice_receptionist_settings_phone_number_key
  ON public.voice_receptionist_settings (phone_number)
  WHERE phone_number IS NOT NULL;

COMMENT ON COLUMN public.voice_receptionist_settings.phone_number IS
  'E.164 number customers call; the inbound webhook resolves to_number -> this agent.';
