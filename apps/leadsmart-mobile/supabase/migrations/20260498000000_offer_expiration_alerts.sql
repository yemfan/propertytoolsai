-- Offer expiration alerts.
--
-- When an offer is about to expire (within 24h) and hasn't been
-- accepted/rejected/countered, the agent needs a nudge. Silent
-- expirations cost deals.
--
-- Dedupe log per (offer_id, alert_level, alert_date) — we send two
-- alerts per offer:
--   * `warning` at 24h before expiration
--   * `final`   at 2h before expiration
--
-- Covers BOTH offer tables (buyer-side `offers` and listing-side
-- `listing_offers`) — one log table, two offer kinds distinguished
-- by the `offer_kind` column.

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
      create table if not exists public.offer_expiration_alert_log (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        offer_kind text not null check (offer_kind in ('buyer', 'listing')),
        offer_id uuid not null,
        alert_level text not null check (alert_level in ('warning', 'final')),
        alert_date date not null,
        email_sent boolean not null default false,
        sms_sent boolean not null default false,
        error text,
        created_at timestamptz not null default now(),
        unique (offer_kind, offer_id, alert_level, alert_date)
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.offer_expiration_alert_log (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        offer_kind text not null check (offer_kind in ('buyer', 'listing')),
        offer_id uuid not null,
        alert_level text not null check (alert_level in ('warning', 'final')),
        alert_date date not null,
        email_sent boolean not null default false,
        sms_sent boolean not null default false,
        error text,
        created_at timestamptz not null default now(),
        unique (offer_kind, offer_id, alert_level, alert_date)
      )
    $sql$;
  end if;
end $$;

create index if not exists idx_offer_expiration_alert_log_agent_date
  on public.offer_expiration_alert_log (agent_id, alert_date desc);
