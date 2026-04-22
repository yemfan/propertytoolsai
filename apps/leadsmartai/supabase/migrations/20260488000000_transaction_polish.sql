-- Transaction Coordinator polish round — two additions:
--
--   1. Per-agent opt-out / frequency controls for the overdue-task
--      digest, plus a wire-fraud SMS opt-in flag. Extends the existing
--      agent_notification_preferences table so agents see all push /
--      digest settings in one place.
--
--   2. transaction_wire_alert_log — dedupe + audit trail for the
--      wire-fraud SMS escalation cron. Mirrors transaction_nudge_log
--      but scoped to the single seed_key='verify_wire_instructions'
--      task that fires SMS (email digest covers everything else).

-- ── 1. Extend agent_notification_preferences ──────────────────────────

alter table public.agent_notification_preferences
  add column if not exists transaction_digest_enabled boolean not null default true;

alter table public.agent_notification_preferences
  add column if not exists transaction_digest_frequency text not null default 'daily';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'agent_notification_preferences_tx_digest_freq_chk'
  ) then
    alter table public.agent_notification_preferences
      add constraint agent_notification_preferences_tx_digest_freq_chk
      check (transaction_digest_frequency in ('daily', 'weekly', 'off'));
  end if;
end $$;

alter table public.agent_notification_preferences
  add column if not exists wire_fraud_sms_enabled boolean not null default true;

comment on column public.agent_notification_preferences.transaction_digest_enabled is
  'Legacy kill-switch. When false, no digest is sent regardless of frequency. Kept as a separate flag so we can add more frequency options later without breaking the "off" state.';

comment on column public.agent_notification_preferences.transaction_digest_frequency is
  'daily (default), weekly (Monday only), or off (explicit opt-out).';

comment on column public.agent_notification_preferences.wire_fraud_sms_enabled is
  'Controls whether the closing-phase wire-verification SMS escalation fires. Defaults to on — this is a fraud-prevention alert, not marketing.';

-- ── 2. transaction_wire_alert_log ─────────────────────────────────────
-- Records when the wire-fraud SMS was sent for a given transaction.
-- The unique constraint on (transaction_id, alert_date) prevents
-- multiple SMS in the same day even if the cron fires repeatedly.
-- Columns mirror transaction_nudge_log for familiarity.

do $$
declare
  v_agent_type text;
begin
  select a.atttypid::regtype::text
    into v_agent_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'agents'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped
  limit 1;

  if v_agent_type is null then
    raise exception 'public.agents.id column not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.transaction_wire_alert_log (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        transaction_id uuid not null references public.transactions(id) on delete cascade,
        alert_date date not null,
        days_to_close int,
        sms_sent boolean not null default false,
        error text,
        created_at timestamptz not null default now(),
        unique (transaction_id, alert_date)
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.transaction_wire_alert_log (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        transaction_id uuid not null references public.transactions(id) on delete cascade,
        alert_date date not null,
        days_to_close int,
        sms_sent boolean not null default false,
        error text,
        created_at timestamptz not null default now(),
        unique (transaction_id, alert_date)
      )
    $sql$;
  end if;
end $$;

create index if not exists idx_transaction_wire_alert_log_agent_date
  on public.transaction_wire_alert_log (agent_id, alert_date desc);
