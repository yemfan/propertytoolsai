-- 00063_voice_reminders_pg_cron.sql
--
-- Drive the voice/SMS appointment-reminder loop from Supabase instead of a
-- Vercel cron. The HelmSmart Vercel project is on the Hobby plan, which forbids
-- sub-daily crons in vercel.json (every deploy is rejected — see PR #569). This
-- pg_cron job GETs the production reminders endpoint every 15 minutes.
--
-- One trigger on Core is enough: /api/cron/voice/reminders loops over every pack
-- connection (packServiceConns) per call, so it serves Core AND the medical
-- pack. Do NOT also schedule this on the medical project, or reminders double-fire.
--
-- Auth: Bearer token read from Vault (secret name 'cron_secret'). The SAME value
-- must be set as CRON_SECRET in the helmsmart Vercel project env so the route
-- (app/api/cron/voice/reminders/route.ts) accepts the call. The Vault secret is
-- provisioned out-of-band (it must never live in the repo).
--
-- Host note: target www.helmsmart.ai directly — the apex helmsmart.ai 307-redirects
-- to www, and pg_net does not follow redirects (the Authorization header would be
-- dropped).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: drop a prior copy of the job before (re)creating it.
select cron.unschedule('helm-voice-reminders')
where exists (select 1 from cron.job where jobname = 'helm-voice-reminders');

select cron.schedule(
  'helm-voice-reminders',
  '*/15 * * * *',
  $job$
  select net.http_get(
    url     := 'https://www.helmsmart.ai/api/cron/voice/reminders',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  );
  $job$
);
