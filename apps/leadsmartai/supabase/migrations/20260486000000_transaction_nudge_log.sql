-- Daily-digest dedupe log for the Transaction Coordinator overdue-task cron.
--
-- The cron at /api/cron/transactions-overdue-nudges fires once per day. We
-- record (agent_id, digest_date) each time an agent actually receives a
-- digest so that:
--
--   * Vercel retries / manual curls don't double-send the same digest.
--   * The timing of yesterday's notification is queryable for debugging
--     "why didn't I get nudged?" complaints.
--
-- The unique constraint on (agent_id, digest_date) is the actual dedupe
-- gate — we INSERT first; if it conflicts we skip sending. This is safer
-- than SELECT-then-INSERT because two concurrent cron invocations (which
-- shouldn't happen but could on retry) would both see no row and both
-- send.
--
-- Retention: we don't need historical rows, but deleting them costs more
-- than keeping them. At one row per agent per day, 1000 agents × 365 days
-- = 365k rows/yr. Ignorable.

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
      create table if not exists public.transaction_nudge_log (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        digest_date date not null,
        task_count int not null default 0,
        overdue_count int not null default 0,
        upcoming_count int not null default 0,
        email_sent boolean not null default false,
        error text,
        created_at timestamptz not null default now(),
        unique (agent_id, digest_date)
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.transaction_nudge_log (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        digest_date date not null,
        task_count int not null default 0,
        overdue_count int not null default 0,
        upcoming_count int not null default 0,
        email_sent boolean not null default false,
        error text,
        created_at timestamptz not null default now(),
        unique (agent_id, digest_date)
      )
    $sql$;
  end if;
end $$;

create index if not exists idx_transaction_nudge_log_agent_date
  on public.transaction_nudge_log (agent_id, digest_date desc);
