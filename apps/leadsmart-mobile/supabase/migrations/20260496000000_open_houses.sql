-- Open House workflow: scheduled events + digital sign-in + follow-up.
--
-- Today agents run open houses on paper sign-in sheets. Visitors get
-- lost, follow-up is manual, and we have no attribution. This replaces
-- that with:
--
--   1. `open_houses`              — scheduled event.
--   2. `open_house_visitors`      — people who signed in at the door
--                                   via a public URL / QR code.
--
-- Public sign-in URL: `/oh/{slug}`. The `signin_slug` is generated on
-- create (12 random chars, URL-safe) and is the only token needed — no
-- auth. Agents share it via QR displayed on an iPad. Low abuse risk
-- for MVP (real visitors use it, spam is unlikely when no rewards
-- flow to the spammer), but we can add hCaptcha if needed.
--
-- Visitor → contact intake: after sign-in the service-layer upserts a
-- row in `contacts` (source='Open House') and back-links
-- `open_house_visitors.contact_id`. The agent's existing nurture
-- pipelines pick up from there.

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
      create table if not exists public.open_houses (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        -- Optional back-link to a listing-rep transaction. Lets the
        -- transaction detail page surface a "sign-in URL" action.
        transaction_id uuid references public.transactions(id) on delete set null,

        property_address text not null,
        city text,
        state text,
        zip text,
        mls_number text,
        mls_url text,
        list_price numeric,

        -- Event window
        start_at timestamptz not null,
        end_at timestamptz not null,

        -- Public sign-in token. 12 URL-safe chars — collision risk at
        -- 62^12 = negligible vs our agent count. Indexed for fast lookup.
        signin_slug text not null unique,

        host_notes text,
        status text not null default 'scheduled'
          check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.open_house_visitors (
        id uuid primary key default gen_random_uuid(),
        open_house_id uuid not null references public.open_houses(id) on delete cascade,
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid references public.contacts(id) on delete set null,

        -- Visitor identity (raw entry from the public form)
        name text,
        email text,
        phone text,

        -- Are they already working with an agent? If so, we don't add
        -- them to the nurture pipeline — that'd be an ethics breach
        -- (and Realtor® code-of-ethics violation).
        is_buyer_agented boolean not null default false,
        buyer_agent_name text,
        buyer_agent_brokerage text,

        -- Qualification signals the agent asks in the form
        timeline text
          check (timeline in ('now', '3_6_months', '6_12_months', 'later', 'just_looking')),
        buyer_status text
          check (buyer_status in ('looking', 'just_browsing', 'neighbor', 'other')),

        -- Marketing consent — required for post-event outreach per CAN-SPAM / TCPA.
        -- Defaults false; if the visitor taps "yes, send similar listings", we set true.
        marketing_consent boolean not null default false,

        -- Follow-up automation tracking
        thank_you_sent_at timestamptz,
        check_in_sent_at timestamptz,

        notes text,
        created_at timestamptz not null default now()
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.open_houses (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        transaction_id uuid references public.transactions(id) on delete set null,

        property_address text not null,
        city text,
        state text,
        zip text,
        mls_number text,
        mls_url text,
        list_price numeric,

        start_at timestamptz not null,
        end_at timestamptz not null,

        signin_slug text not null unique,

        host_notes text,
        status text not null default 'scheduled'
          check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.open_house_visitors (
        id uuid primary key default gen_random_uuid(),
        open_house_id uuid not null references public.open_houses(id) on delete cascade,
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid references public.contacts(id) on delete set null,

        name text,
        email text,
        phone text,

        is_buyer_agented boolean not null default false,
        buyer_agent_name text,
        buyer_agent_brokerage text,

        timeline text
          check (timeline in ('now', '3_6_months', '6_12_months', 'later', 'just_looking')),
        buyer_status text
          check (buyer_status in ('looking', 'just_browsing', 'neighbor', 'other')),

        marketing_consent boolean not null default false,

        thank_you_sent_at timestamptz,
        check_in_sent_at timestamptz,

        notes text,
        created_at timestamptz not null default now()
      )
    $sql$;
  end if;
end $$;

create index if not exists idx_open_houses_agent_start
  on public.open_houses (agent_id, start_at desc);

create index if not exists idx_open_houses_slug
  on public.open_houses (signin_slug);

create index if not exists idx_open_house_visitors_open_house
  on public.open_house_visitors (open_house_id, created_at desc);

-- Follow-up cron queries: "visitors created 20-30h ago who haven't
-- gotten a thank-you yet" and "visitors created 3-4 days ago who
-- haven't gotten a check-in yet." Partial indexes keep these fast
-- as the visitor table grows.
create index if not exists idx_open_house_visitors_thank_you_due
  on public.open_house_visitors (created_at)
  where thank_you_sent_at is null and marketing_consent = true;

create index if not exists idx_open_house_visitors_checkin_due
  on public.open_house_visitors (created_at)
  where check_in_sent_at is null and marketing_consent = true;
