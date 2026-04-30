-- Buyer-side offer tracker. Closes the gap between showing (buyer
-- wants to make an offer) and transaction (ratified contract).
--
-- Two tables:
--
--   offers          — one row per offer attempt. Lifecycle: draft →
--                     submitted → countered* → accepted / rejected /
--                     withdrawn / expired. Accepted offers spawn a
--                     transaction (via service.convertOfferToTransaction).
--
--   offer_counters  — one row per counter round. Offers frequently go
--                     through 2-4 rounds; capturing the history gives
--                     agents + buyers a clear negotiation record and
--                     lets us show a timeline on the detail page.
--
-- Why a dedicated subsystem vs extending transactions:
--   * Transactions are post-ratification deal management (escrow,
--     contingencies, closing). Offers are pre-ratification negotiation.
--     90% of offers never become transactions — most are outbid,
--     rejected, or withdrawn.
--   * A buyer typically writes 3-8 offers before one gets accepted.
--     Keeping them in their own table keeps the transactions list
--     clean and the win-rate analytics honest.
--
-- Relationship to other entities:
--   * `showing_id` (nullable) — an offer often comes from a showing
--     where the buyer flagged "would_offer". Not required: some offers
--     are sight-unseen, some come from new-construction walkthroughs
--     that weren't logged as showings.
--   * `transaction_id` (nullable) — populated at the moment of
--     conversion. Lets us trace any transaction back to its origin
--     offer for win-rate / negotiation analysis.

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
      create table if not exists public.offers (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid not null references public.contacts(id) on delete cascade,

        -- Optional provenance links
        showing_id uuid references public.showings(id) on delete set null,
        transaction_id uuid references public.transactions(id) on delete set null,

        -- Property identity
        property_address text not null,
        city text,
        state text,
        zip text,
        mls_number text,
        mls_url text,
        list_price numeric,

        -- Offer terms
        offer_price numeric not null,
        earnest_money numeric,
        down_payment numeric,
        financing_type text
          check (financing_type in ('cash', 'conventional', 'fha', 'va', 'jumbo', 'other')),
        closing_date_proposed date,

        -- Common contingencies — inline booleans for cheap filtering.
        -- `contingency_notes` holds anything unusual the booleans can't
        -- capture (sale-of-home, short-sale waiting, etc.).
        inspection_contingency boolean not null default true,
        appraisal_contingency boolean not null default true,
        loan_contingency boolean not null default true,
        contingency_notes text,

        -- Status lifecycle
        status text not null default 'draft'
          check (status in ('draft', 'submitted', 'countered', 'accepted', 'rejected', 'withdrawn', 'expired')),
        current_price numeric,          -- latest price after counters
        offer_expires_at timestamptz,   -- "offer good through" timestamp

        -- Timestamps for key lifecycle events (more useful than status history alone)
        submitted_at timestamptz,
        accepted_at timestamptz,
        closed_at timestamptz,          -- rejected/withdrawn/expired

        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.offer_counters (
        id uuid primary key default gen_random_uuid(),
        offer_id uuid not null references public.offers(id) on delete cascade,
        counter_number int not null,            -- 1, 2, 3... within this offer
        direction text not null
          check (direction in ('seller_to_buyer', 'buyer_to_seller')),
        price numeric,
        changed_fields jsonb,                    -- free-form record of what moved
        notes text,
        created_at timestamptz not null default now(),
        unique (offer_id, counter_number)
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.offers (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid not null references public.contacts(id) on delete cascade,

        showing_id uuid references public.showings(id) on delete set null,
        transaction_id uuid references public.transactions(id) on delete set null,

        property_address text not null,
        city text,
        state text,
        zip text,
        mls_number text,
        mls_url text,
        list_price numeric,

        offer_price numeric not null,
        earnest_money numeric,
        down_payment numeric,
        financing_type text
          check (financing_type in ('cash', 'conventional', 'fha', 'va', 'jumbo', 'other')),
        closing_date_proposed date,

        inspection_contingency boolean not null default true,
        appraisal_contingency boolean not null default true,
        loan_contingency boolean not null default true,
        contingency_notes text,

        status text not null default 'draft'
          check (status in ('draft', 'submitted', 'countered', 'accepted', 'rejected', 'withdrawn', 'expired')),
        current_price numeric,
        offer_expires_at timestamptz,

        submitted_at timestamptz,
        accepted_at timestamptz,
        closed_at timestamptz,

        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.offer_counters (
        id uuid primary key default gen_random_uuid(),
        offer_id uuid not null references public.offers(id) on delete cascade,
        counter_number int not null,
        direction text not null
          check (direction in ('seller_to_buyer', 'buyer_to_seller')),
        price numeric,
        changed_fields jsonb,
        notes text,
        created_at timestamptz not null default now(),
        unique (offer_id, counter_number)
      )
    $sql$;
  end if;
end $$;

-- List queries are always "this agent's offers, recent first" or
-- "this buyer's offers." These two indexes cover both.
create index if not exists idx_offers_agent_created
  on public.offers (agent_id, created_at desc);

create index if not exists idx_offers_contact_created
  on public.offers (contact_id, created_at desc);

-- Win-rate analytics queries will filter on status.
create index if not exists idx_offers_agent_status
  on public.offers (agent_id, status);

create index if not exists idx_offer_counters_offer
  on public.offer_counters (offer_id, counter_number);
