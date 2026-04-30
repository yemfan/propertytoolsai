-- Listing-side offer review. Mirror of the buyer-side offer tracker
-- for agents representing sellers.
--
-- A listing agent typically fields 2-10 competing offers on a single
-- listing and needs to compare them side-by-side, factor net-to-seller
-- (not just sticker price), negotiate counters, and accept one.
--
-- Why a new table vs extending `offers`:
--   * offers.contact_id = the BUYER (our client) on the buyer side.
--     On the listing side, the offeror is someone else's client —
--     we have buyer-agent contact info but not CRM-contact status.
--     Overloading contact_id with two semantics leads to messy
--     queries + accidental cross-contamination.
--   * The counter mechanics are conceptually identical but domain-
--     separate. We duplicate the pattern instead of sharing — zero
--     test or runtime coupling between buyer + listing flows.
--
-- FK: `transaction_id` points at a transactions row with
-- transaction_type in ('listing_rep', 'dual'). Not enforced in
-- schema because the CHECK would require a function call; enforced
-- in the service layer.

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
      create table if not exists public.listing_offers (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        transaction_id uuid not null references public.transactions(id) on delete cascade,

        -- Offeror identity (the buyer + their agent; NOT our CRM contacts)
        buyer_name text,
        buyer_brokerage text,
        buyer_agent_name text,
        buyer_agent_email text,
        buyer_agent_phone text,

        -- Offer terms
        offer_price numeric not null,
        current_price numeric,
        earnest_money numeric,
        down_payment numeric,
        financing_type text
          check (financing_type in ('cash', 'conventional', 'fha', 'va', 'jumbo', 'other')),
        closing_date_proposed date,

        -- Contingencies (inline booleans + free-form notes)
        inspection_contingency boolean not null default true,
        appraisal_contingency boolean not null default true,
        loan_contingency boolean not null default true,
        sale_of_home_contingency boolean not null default false,
        contingency_notes text,

        -- Seller-side concessions this offer requests
        seller_concessions numeric,

        -- Lifecycle
        status text not null default 'submitted'
          check (status in ('submitted', 'countered', 'accepted', 'rejected', 'withdrawn', 'expired')),
        offer_expires_at timestamptz,
        submitted_at timestamptz default now(),
        accepted_at timestamptz,
        closed_at timestamptz,

        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.listing_offer_counters (
        id uuid primary key default gen_random_uuid(),
        listing_offer_id uuid not null references public.listing_offers(id) on delete cascade,
        counter_number int not null,
        direction text not null
          check (direction in ('seller_to_buyer', 'buyer_to_seller')),
        price numeric,
        changed_fields jsonb,
        notes text,
        created_at timestamptz not null default now(),
        unique (listing_offer_id, counter_number)
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.listing_offers (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        transaction_id uuid not null references public.transactions(id) on delete cascade,

        buyer_name text,
        buyer_brokerage text,
        buyer_agent_name text,
        buyer_agent_email text,
        buyer_agent_phone text,

        offer_price numeric not null,
        current_price numeric,
        earnest_money numeric,
        down_payment numeric,
        financing_type text
          check (financing_type in ('cash', 'conventional', 'fha', 'va', 'jumbo', 'other')),
        closing_date_proposed date,

        inspection_contingency boolean not null default true,
        appraisal_contingency boolean not null default true,
        loan_contingency boolean not null default true,
        sale_of_home_contingency boolean not null default false,
        contingency_notes text,

        seller_concessions numeric,

        status text not null default 'submitted'
          check (status in ('submitted', 'countered', 'accepted', 'rejected', 'withdrawn', 'expired')),
        offer_expires_at timestamptz,
        submitted_at timestamptz default now(),
        accepted_at timestamptz,
        closed_at timestamptz,

        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.listing_offer_counters (
        id uuid primary key default gen_random_uuid(),
        listing_offer_id uuid not null references public.listing_offers(id) on delete cascade,
        counter_number int not null,
        direction text not null
          check (direction in ('seller_to_buyer', 'buyer_to_seller')),
        price numeric,
        changed_fields jsonb,
        notes text,
        created_at timestamptz not null default now(),
        unique (listing_offer_id, counter_number)
      )
    $sql$;
  end if;
end $$;

-- Compare view is the primary query: "all offers on this listing,
-- ordered by price desc." Secondary: agent-wide status roll-ups.
create index if not exists idx_listing_offers_transaction
  on public.listing_offers (transaction_id, status);

create index if not exists idx_listing_offers_agent_created
  on public.listing_offers (agent_id, created_at desc);

create index if not exists idx_listing_offer_counters_offer
  on public.listing_offer_counters (listing_offer_id, counter_number);
