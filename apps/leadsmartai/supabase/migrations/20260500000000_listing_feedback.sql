-- Cross-agent feedback on listings.
--
-- The listing agent's blind spot: when a buyer-rep agent shows their
-- listing, that showing + any feedback lives in the BUYER agent's
-- scoped tables. The listing agent never sees it unless someone
-- emails it over. Industry workaround: ShowingTime etc. route a
-- feedback form to the buyer agent after every showing.
--
-- This is our homegrown version. Flow:
--   1. Listing agent records that a buyer agent showed the listing
--      (buyer_agent_name, email, showing_date) — creates a row with a
--      unique `request_slug`.
--   2. We email the buyer agent a link to /feedback/<slug>.
--   3. Buyer agent (or their buyer) fills out the public form. The
--      row is updated with rating, pros, cons, notes, submitted_at.
--   4. Listing agent sees all responses on the transaction detail +
--      in the weekly seller update email.
--
-- One table (no separate request vs response tables) — state flows
-- via submitted_at null/non-null. Simpler, no join required to show
-- "pending vs received."

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
      create table if not exists public.listing_feedback (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        transaction_id uuid not null references public.transactions(id) on delete cascade,

        -- Buyer-side identity (free-form strings — not CRM contacts)
        buyer_agent_name text,
        buyer_agent_email text,
        buyer_agent_phone text,
        buyer_agent_brokerage text,
        buyer_name text,

        -- Event metadata
        showing_date date,

        -- Public form token (12 chars, url-safe)
        request_slug text not null unique,
        request_email_sent_at timestamptz,

        -- Response fields — populated when the buyer agent submits the form
        submitted_at timestamptz,
        rating int check (rating >= 1 and rating <= 5),
        overall_reaction text
          check (overall_reaction in ('love', 'like', 'maybe', 'pass')),
        pros text,
        cons text,
        price_feedback text
          check (price_feedback in ('too_high', 'about_right', 'bargain')),
        would_offer boolean,
        notes text,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.listing_feedback (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        transaction_id uuid not null references public.transactions(id) on delete cascade,

        buyer_agent_name text,
        buyer_agent_email text,
        buyer_agent_phone text,
        buyer_agent_brokerage text,
        buyer_name text,

        showing_date date,

        request_slug text not null unique,
        request_email_sent_at timestamptz,

        submitted_at timestamptz,
        rating int check (rating >= 1 and rating <= 5),
        overall_reaction text
          check (overall_reaction in ('love', 'like', 'maybe', 'pass')),
        pros text,
        cons text,
        price_feedback text
          check (price_feedback in ('too_high', 'about_right', 'bargain')),
        would_offer boolean,
        notes text,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  end if;
end $$;

-- Primary query: "all feedback on this listing, responses first then pending"
create index if not exists idx_listing_feedback_transaction
  on public.listing_feedback (transaction_id, submitted_at desc nulls last);

-- Secondary: fast slug lookup for the public form
create index if not exists idx_listing_feedback_slug
  on public.listing_feedback (request_slug);
