-- Per-agent configuration for the LeadSmart AI voice receptionist.
--
-- The Retell inbound webhook (app/api/retell/inbound) builds the agent's greeting
-- and system prompt from this row (via lib/voice-agent/context.ts), falling back
-- to the account display name + sensible defaults when a field is unset. `enabled`
-- = false makes the webhook serve no prompt (receptionist effectively off).
--
-- Idempotent: safe to re-run. Apply with:
--   pnpm --filter leadsmartai db:migrate:remote
--   (or) node ./scripts/apply-supabase-sql-remote.mjs supabase/migrations/20260531000000_voice_receptionist_settings.sql

CREATE TABLE IF NOT EXISTS public.voice_receptionist_settings (
  agent_id          bigint PRIMARY KEY REFERENCES public.agents (id) ON DELETE CASCADE,
  enabled           boolean NOT NULL DEFAULT true,
  business_name     text,
  business_name_zh  text,
  agent_name        text,
  greeting          text,
  timezone          text NOT NULL DEFAULT 'America/New_York',
  extra_notes       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.voice_receptionist_settings IS
  'Per-agent AI voice receptionist config (identity + knowledge) read by the Retell inbound webhook.';

-- The app reads/writes this only through the service-role client (supabaseAdmin),
-- which bypasses RLS. Enable RLS with no public policies so anon/authenticated
-- roles are denied by default.
ALTER TABLE public.voice_receptionist_settings ENABLE ROW LEVEL SECURITY;
