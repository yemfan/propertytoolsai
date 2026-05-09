-- Phase 1 of the listings/transactions split (see
-- apps/leadsmartai/docs/LISTINGS_TABLE_SPLIT_DESIGN.md).
--
-- This migration is intentionally **read-path neutral**: it creates
-- the `listings` table, backfills it from existing
-- `transactions WHERE transaction_type IN ('listing_rep', 'dual')`,
-- adds back-link columns to satellite tables (listing_offers,
-- listing_feedback, open_houses), and adds a `source_listing_id`
-- column on transactions. **All existing reads continue to work
-- against the transactions table.** Cutover happens in Phase 2.
--
-- The migration is dual-typed because `agents.id` is `bigint` in
-- this DB but the original transactions migration ships a `uuid`
-- branch too. We mirror that pattern so the schema is reproducible
-- across either deployment shape.
--
-- Idempotency: every DDL statement uses `if not exists` / `if not
-- exists`-equivalent guards so re-running this migration after a
-- partial application doesn't error. The backfill uses an
-- `on conflict do nothing` pattern (against a unique key on
-- listings.transaction_id) so re-running doesn't duplicate rows.

do $$
declare
  v_agent_type text;
begin
  -- Detect agents.id type (matches the pattern in
  -- 20260485000000_transaction_coordinator.sql).
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

  -- ── listings table ─────────────────────────────────────────────
  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.listings (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid not null references public.contacts(id) on delete cascade,

        property_address text not null,
        city text,
        state text,
        zip text,
        mls_number text,
        mls_url text,

        list_price numeric,

        listing_start_date date,
        listing_end_date date,

        -- Listing-side lifecycle:
        --   draft       = RLA being prepared
        --   active      = on MLS, taking showings
        --   pending     = under contract (offer accepted but listing
        --                 not yet promoted to a transaction row)
        --   contracted  = pending offer is now a transaction
        --   withdrawn   = pulled before expiry
        --   expired     = RLA hit listing_end_date
        status text not null default 'draft'
          check (status in ('draft','active','pending','contracted','withdrawn','expired')),

        -- Set on lifecycle promotion when an accepted offer becomes
        -- a transaction. Symmetric back-link lives on transactions
        -- as `source_listing_id`. Both nullable so each side can
        -- exist independently during backfill.
        transaction_id uuid references public.transactions(id) on delete set null,

        commission_pct numeric,
        seller_update_enabled boolean not null default false,
        seller_update_last_sent_at timestamptz,

        notes text,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.listings (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid not null references public.contacts(id) on delete cascade,

        property_address text not null,
        city text,
        state text,
        zip text,
        mls_number text,
        mls_url text,

        list_price numeric,

        listing_start_date date,
        listing_end_date date,

        status text not null default 'draft'
          check (status in ('draft','active','pending','contracted','withdrawn','expired')),

        transaction_id uuid references public.transactions(id) on delete set null,

        commission_pct numeric,
        seller_update_enabled boolean not null default false,
        seller_update_last_sent_at timestamptz,

        notes text,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

-- One unique constraint on transaction_id so we can `on conflict
-- (transaction_id) do nothing` during backfill — also guarantees
-- one listing per source transaction during the dual-write window.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'listings_transaction_id_unique'
  ) then
    alter table public.listings
      add constraint listings_transaction_id_unique unique (transaction_id);
  end if;
end $$;

-- Indexes that the listings list view + agent-scoped queries hit.
create index if not exists idx_listings_agent_status
  on public.listings (agent_id, status);
create index if not exists idx_listings_agent_listing_start
  on public.listings (agent_id, listing_start_date desc nulls last);
create index if not exists idx_listings_property_address
  on public.listings (property_address);

-- ── transactions.source_listing_id ─────────────────────────────────
-- Back-link from a post-acceptance transaction to the listing it
-- originated from (set on lifecycle promotion in Phase 2).
alter table public.transactions
  add column if not exists source_listing_id uuid
  references public.listings(id) on delete set null;

create index if not exists idx_transactions_source_listing
  on public.transactions (source_listing_id)
  where source_listing_id is not null;

-- ── satellite tables: add listing_id columns ───────────────────────
-- listing_offers, listing_feedback, open_houses currently FK to
-- transactions. Add nullable listing_id columns so Phase 2 can
-- swap reads to use them while the old FK keeps working.

alter table public.listing_offers
  add column if not exists listing_id uuid
  references public.listings(id) on delete cascade;

create index if not exists idx_listing_offers_listing
  on public.listing_offers (listing_id)
  where listing_id is not null;

alter table public.listing_feedback
  add column if not exists listing_id uuid
  references public.listings(id) on delete cascade;

create index if not exists idx_listing_feedback_listing
  on public.listing_feedback (listing_id)
  where listing_id is not null;

alter table public.open_houses
  add column if not exists listing_id uuid
  references public.listings(id) on delete set null;

create index if not exists idx_open_houses_listing
  on public.open_houses (listing_id)
  where listing_id is not null;

-- ── Backfill: transactions → listings ──────────────────────────────
-- Every transaction with type IN ('listing_rep', 'dual') gets a
-- corresponding listings row. The `transaction_id` back-link is
-- preserved so Phase 2 can promote/cleanup atomically.
--
-- Status mapping:
--   transactions.status='active'    + mutual_acceptance_date IS NULL → listings.status='active'
--   transactions.status='active'    + mutual_acceptance_date IS NOT NULL → listings.status='contracted'
--   transactions.status='closed'    → listings.status='contracted'
--   transactions.status='terminated'→ listings.status='withdrawn'
--   transactions.status='pending'   → listings.status='pending'
--
-- Conservative: anything that doesn't fit gets `draft` so a follow-up
-- migration can revisit. Backfill is idempotent via the unique
-- constraint on transaction_id.
insert into public.listings (
  agent_id,
  contact_id,
  property_address,
  city,
  state,
  zip,
  list_price,
  listing_start_date,
  status,
  transaction_id,
  commission_pct,
  seller_update_enabled,
  seller_update_last_sent_at,
  notes,
  created_at,
  updated_at
)
select
  t.agent_id,
  t.contact_id,
  t.property_address,
  t.city,
  t.state,
  t.zip,
  t.purchase_price,
  t.listing_start_date,
  case
    when t.status = 'terminated' then 'withdrawn'
    when t.status = 'pending'    then 'pending'
    when t.status = 'closed'     then 'contracted'
    when t.status = 'active' and t.mutual_acceptance_date is not null then 'contracted'
    when t.status = 'active' then 'active'
    else 'draft'
  end as status,
  t.id as transaction_id,
  t.commission_pct,
  coalesce(t.seller_update_enabled, false) as seller_update_enabled,
  t.seller_update_last_sent_at,
  t.notes,
  t.created_at,
  t.updated_at
from public.transactions t
where t.transaction_type in ('listing_rep', 'dual')
on conflict (transaction_id) do nothing;

-- ── Backfill: transactions.source_listing_id ───────────────────────
-- For every transaction that already has a listings row (i.e. it's
-- a listing_rep or dual transaction), point source_listing_id at
-- the new listing so the bidirectional link is in place from
-- day one.
update public.transactions t
set source_listing_id = l.id
from public.listings l
where l.transaction_id = t.id
  and t.source_listing_id is null;

-- ── Backfill: listing_offers / listing_feedback / open_houses ──────
-- Each row's transaction_id maps to a listing via listings.transaction_id.
-- Some old rows might point at a buyer-rep transaction by mistake —
-- skip those (their listing_id stays null and we'll surface them in
-- the consistency check below).
update public.listing_offers lo
set listing_id = l.id
from public.listings l
where l.transaction_id = lo.transaction_id
  and lo.listing_id is null;

update public.listing_feedback lf
set listing_id = l.id
from public.listings l
where l.transaction_id = lf.transaction_id
  and lf.listing_id is null;

update public.open_houses oh
set listing_id = l.id
from public.listings l
where l.transaction_id = oh.transaction_id
  and oh.listing_id is null;

-- ── Consistency assertions ─────────────────────────────────────────
-- These run inline as part of the migration. If any drift, the
-- migration aborts with a useful message — easier to investigate at
-- migration time than after the fact.
do $$
declare
  v_source_count   bigint;
  v_listings_count bigint;
  v_orphan_offers  bigint;
  v_orphan_feedback bigint;
begin
  -- Every listing-rep / dual transaction should have a listing row.
  select count(*) into v_source_count
    from public.transactions
    where transaction_type in ('listing_rep', 'dual');

  select count(*) into v_listings_count
    from public.listings
    where transaction_id is not null;

  if v_source_count <> v_listings_count then
    raise exception
      'listings backfill drift: % source transactions but % listings rows',
      v_source_count, v_listings_count;
  end if;

  -- listing_offers should mostly have listing_id set now. Surface
  -- (don't fail) any orphans because they may legitimately reference
  -- a buyer-rep transaction (a misuse of listing_offers, but real
  -- data could have it). Phase 2 cutover will reject orphans.
  select count(*) into v_orphan_offers
    from public.listing_offers
    where listing_id is null;

  select count(*) into v_orphan_feedback
    from public.listing_feedback
    where listing_id is null;

  raise notice
    'listings split phase 1: % listings backfilled, % orphan listing_offers, % orphan listing_feedback',
    v_listings_count, v_orphan_offers, v_orphan_feedback;
end $$;

comment on table public.listings is
  'Pre-acceptance listing inventory. Phase 1 of the listings/transactions split — populated by backfill from transactions WHERE transaction_type IN (listing_rep, dual). Phase 2 cuts read paths over to this table; Phase 3 drops legacy columns from transactions.';

comment on column public.listings.transaction_id is
  'Back-link to the source transaction for the dual-write window. Phase 3 will promote this to a forward-link (set only when an offer is accepted and a post-acceptance transaction is spawned).';

comment on column public.transactions.source_listing_id is
  'Forward-link from a post-acceptance transaction back to the listing it came from. Set on lifecycle promotion (Phase 2). Null for pure buyer-rep deals that didn''t originate from a listing in this CRM.';
