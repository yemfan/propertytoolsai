-- Full schema for PropertyTools AI (property warehouse + cache + Stripe agent fields)
-- Run in Supabase SQL editor.

-- Extensions
create extension if not exists "pgcrypto";

-- updated_at helper (needed for triggers)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================
-- FAST CACHE
-- =========================
create table if not exists public.properties_cache (
  id uuid primary key default gen_random_uuid(),
  address text,
  city text,
  state text,
  zip_code text,
  data jsonb,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- If properties_cache already existed without `address`, add it (and try to backfill)
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'properties_cache'
  ) then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'properties_cache' and column_name = 'address'
    ) then
      alter table public.properties_cache add column address text;
    end if;

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'properties_cache' and column_name = 'zip_code'
    ) then
      alter table public.properties_cache add column zip_code text;
    end if;

    -- Optional backfill if an older column exists (adjust as needed)
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'properties_cache' and column_name = 'address_line1'
    ) then
      update public.properties_cache
      set address = lower(regexp_replace(trim(address_line1), '\s+', ' ', 'g'))
      where address is null and address_line1 is not null;
    end if;

    -- Optional backfill for zip_code if older column exists
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'properties_cache' and column_name = 'zip'
    ) then
      update public.properties_cache
      set zip_code = zip
      where zip_code is null and zip is not null;
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'properties_cache' and column_name = 'postal_code'
    ) then
      update public.properties_cache
      set zip_code = postal_code
      where zip_code is null and postal_code is not null;
    end if;
  end if;
end $$;

-- Add uniqueness + index only if the column exists
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'properties_cache' and column_name = 'address'
  ) then
    -- Unique constraint (named) if not present
    if not exists (
      select 1
      from pg_constraint
      where conname = 'properties_cache_address_key'
    ) then
      alter table public.properties_cache
        add constraint properties_cache_address_key unique (address);
    end if;

    create index if not exists idx_properties_cache_address on public.properties_cache(address);
  end if;
end $$;

-- =========================
-- PROPERTY WAREHOUSE
-- =========================
-- IMPORTANT:
-- If you already have a `public.properties` table with `id bigint`, we cannot
-- create UUID-based FKs to it. In that case we create a separate warehouse
-- table `public.properties_dw` (uuid PK) and related tables with *_dw suffix.

do $$
declare
  props_id_type text;
begin
  select data_type into props_id_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'properties' and column_name = 'id';

  if props_id_type is null then
    -- No existing properties table: create UUID-based warehouse as `public.properties`
    execute $sql$
      create table if not exists public.properties (
        id uuid primary key default gen_random_uuid(),
        address text,
        city text,
        state text,
        zip_code text,
        lat double precision,
        lng double precision,
        property_type text,
        beds int,
        baths double precision,
        sqft int,
        lot_size int,
        year_built int,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    $sql$;
  elsif props_id_type <> 'uuid' then
    -- Existing properties table with non-uuid id (e.g. bigint): create separate DW tables
    execute $sql$
      create table if not exists public.properties_dw (
        id uuid primary key default gen_random_uuid(),
        address text unique,
        city text,
        state text,
        zip_code text,
        lat double precision,
        lng double precision,
        property_type text,
        beds int,
        baths double precision,
        sqft int,
        lot_size int,
        year_built int,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    $sql$;
  else
    -- Existing properties table already UUID-based: ensure columns exist (no-op if they do)
    null;
  end if;
end $$;

-- Ensure `address` exists and is normalized; add unique constraint + index
-- Only applies to UUID-based `public.properties` (not properties_dw)
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'properties' and column_name = 'address'
  ) then
    alter table public.properties add column address text;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'properties' and column_name = 'zip_code'
  ) then
    alter table public.properties add column zip_code text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'properties' and column_name = 'address_line1'
  ) then
    update public.properties
    set address = lower(regexp_replace(trim(address_line1), '\s+', ' ', 'g'))
    where address is null and address_line1 is not null;
  end if;

  -- Optional backfill for zip_code if older column exists
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'properties' and column_name = 'zip'
  ) then
    update public.properties
    set zip_code = zip
    where zip_code is null and zip is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'properties' and column_name = 'postal_code'
  ) then
    update public.properties
    set zip_code = postal_code
    where zip_code is null and postal_code is not null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'properties_address_key'
  ) then
    alter table public.properties
      add constraint properties_address_key unique (address);
  end if;
end $$;

create index if not exists idx_properties_wh_address on public.properties(address);
-- Only create zip index if column exists
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'properties' and column_name = 'zip_code'
  ) then
    create index if not exists idx_properties_wh_zip on public.properties(zip_code);
  end if;
end $$;

-- If we created properties_dw, add indexes + updated_at trigger there too
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'properties_dw'
  ) then
    create index if not exists idx_properties_dw_address on public.properties_dw(address);
    create index if not exists idx_properties_dw_zip on public.properties_dw(zip_code);

    drop trigger if exists trg_properties_dw_updated_at on public.properties_dw;
    create trigger trg_properties_dw_updated_at
    before update on public.properties_dw
    for each row
    execute procedure public.set_updated_at();
  end if;
end $$;

drop trigger if exists trg_properties_updated_at on public.properties;
create trigger trg_properties_updated_at
before update on public.properties
for each row
execute procedure public.set_updated_at();

-- Snapshots/comps:
-- If `public.properties` is UUID-based, create these normally.
-- If `public.properties_dw` exists, create *_dw versions referencing it.

do $$
declare
  props_id_type text;
begin
  select data_type into props_id_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'properties' and column_name = 'id';

  if props_id_type = 'uuid' or props_id_type is null then
    execute $sql$
      create table if not exists public.property_snapshots (
        id uuid primary key default gen_random_uuid(),
        property_id uuid not null references public.properties(id) on delete cascade,
        estimated_value numeric,
        rent_estimate numeric,
        price_per_sqft numeric,
        listing_status text,
        data jsonb,
        created_at timestamptz not null default now()
      );
    $sql$;

    execute $sql$
      create index if not exists idx_property_snapshots_property_id_created_at
        on public.property_snapshots(property_id, created_at desc);
    $sql$;

    execute $sql$
      create table if not exists public.property_comps (
        id uuid primary key default gen_random_uuid(),
        subject_property_id uuid not null references public.properties(id) on delete cascade,
        comp_property_id uuid not null references public.properties(id) on delete cascade,
        distance_miles double precision,
        sold_price numeric,
        sold_date date,
        similarity_score double precision,
        created_at timestamptz not null default now(),
        unique(subject_property_id, comp_property_id)
      );
    $sql$;

    execute $sql$
      create index if not exists idx_property_comps_subject on public.property_comps(subject_property_id);
    $sql$;
    execute $sql$
      create index if not exists idx_property_comps_comp on public.property_comps(comp_property_id);
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'properties_dw'
  ) then
    execute $sql$
      create table if not exists public.property_snapshots_dw (
        id uuid primary key default gen_random_uuid(),
        property_id uuid not null references public.properties_dw(id) on delete cascade,
        estimated_value numeric,
        rent_estimate numeric,
        price_per_sqft numeric,
        listing_status text,
        data jsonb,
        created_at timestamptz not null default now()
      );
    $sql$;

    execute $sql$
      create index if not exists idx_property_snapshots_dw_property_id_created_at
        on public.property_snapshots_dw(property_id, created_at desc);
    $sql$;

    execute $sql$
      create table if not exists public.property_comps_dw (
        id uuid primary key default gen_random_uuid(),
        subject_property_id uuid not null references public.properties_dw(id) on delete cascade,
        comp_property_id uuid not null references public.properties_dw(id) on delete cascade,
        distance_miles double precision,
        sold_price numeric,
        sold_date date,
        similarity_score double precision,
        created_at timestamptz not null default now(),
        unique(subject_property_id, comp_property_id)
      );
    $sql$;

    execute $sql$
      create index if not exists idx_property_comps_dw_subject on public.property_comps_dw(subject_property_id);
    $sql$;
    execute $sql$
      create index if not exists idx_property_comps_dw_comp on public.property_comps_dw(comp_property_id);
    $sql$;
  end if;
end $$;

-- Convenience view to point your app at a stable name.
-- If `public.properties` is UUID-based, use it. Otherwise use `public.properties_dw`.
do $$
declare
  props_id_type text;
begin
  select data_type into props_id_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'properties' and column_name = 'id';

  if props_id_type = 'uuid' or props_id_type is null then
    execute 'create or replace view public.properties_warehouse as select * from public.properties';
  elsif exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'properties_dw'
  ) then
    execute 'create or replace view public.properties_warehouse as select * from public.properties_dw';
  end if;
end $$;

-- Convenience views for snapshots/comps with stable names
do $$
declare
  props_id_type text;
begin
  select data_type into props_id_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'properties' and column_name = 'id';

  -- Snapshots view
  if props_id_type = 'uuid' or props_id_type is null then
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'property_snapshots'
    ) then
      execute 'create or replace view public.property_snapshots_warehouse as select * from public.property_snapshots';
    end if;
  elsif exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'property_snapshots_dw'
  ) then
    execute 'create or replace view public.property_snapshots_warehouse as select * from public.property_snapshots_dw';
  end if;

  -- Comps view
  if props_id_type = 'uuid' or props_id_type is null then
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'property_comps'
    ) then
      execute 'create or replace view public.property_comps_warehouse as select * from public.property_comps';
    end if;
  elsif exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'property_comps_dw'
  ) then
    execute 'create or replace view public.property_comps_warehouse as select * from public.property_comps_dw';
  end if;
end $$;

-- =========================
-- AGENTS: Stripe + monetization fields
-- =========================
alter table if exists public.agents
  add column if not exists plan_type text not null default 'free',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

create index if not exists idx_agents_user_id on public.agents(user_id);
create index if not exists idx_agents_stripe_customer_id on public.agents(stripe_customer_id);
create index if not exists idx_agents_stripe_subscription_id on public.agents(stripe_subscription_id);

-- =========================
-- APP USERS (Auth profile)
-- =========================
-- Stores role info for the landing page (agent vs regular user).
create table if not exists public.users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user',
  full_name text,
  license_number text,
  brokerage text,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_role on public.users(role);
create index if not exists idx_users_created_at on public.users(created_at desc);

-- If `users` was created from an older script, add missing columns (safe to re-run).
alter table public.users add column if not exists role text;
alter table public.users add column if not exists full_name text;
alter table public.users add column if not exists license_number text;
alter table public.users add column if not exists brokerage text;
alter table public.users add column if not exists created_at timestamptz not null default now();
update public.users set role = coalesce(nullif(trim(role), ''), 'user') where role is null;
alter table public.users alter column role set default 'user';
-- Ensure role is NOT NULL when column existed but was nullable
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'role' and is_nullable = 'YES'
  ) then
    update public.users set role = 'user' where role is null;
    alter table public.users alter column role set not null;
  end if;
end $$;

-- Ensure `user_id` exists for role detection + upsert conflict handling.
-- Some older DBs may have created `public.users` without this column.
alter table public.users add column if not exists user_id uuid;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'id'
  ) then
    -- Best-effort: migrate existing auth id stored in an `id` column.
    update public.users set user_id = id where user_id is null;
  end if;
end $$;
create unique index if not exists idx_users_user_id on public.users(user_id);

-- =========================
-- OPEN HOUSE REPORTS
-- =========================
-- Used by the `/api/open-house-lead` pipeline to store estimator + CMA + rent snapshots.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  lead_id uuid,
  report_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_reports_property_id on public.reports(property_id);
create index if not exists idx_reports_lead_id on public.reports(lead_id);

-- =========================
-- LISTING PRESENTATIONS
-- =========================
-- Used by `/api/generate-presentation` to store seller presentation content
-- (AI strategy + marketing plan + CMA comps summary).
create table if not exists public.presentations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  property_address text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_presentations_agent_id_created_at on public.presentations(agent_id, created_at desc);
create index if not exists idx_presentations_property_address on public.presentations(property_address);

-- Attach report ids back to CRM leads (best-effort; if columns don't exist, code retries gracefully).
alter table if exists public.leads
  add column if not exists property_id uuid,
  add column if not exists report_id uuid;

-- =========================
-- LEAD SEARCH SETTINGS
-- =========================
-- Used by Smart Lead Notifications to match leads based on nearby activity.
alter table if exists public.leads
  add column if not exists search_location text,
  add column if not exists search_radius double precision default 2,
  add column if not exists price_min double precision,
  add column if not exists price_max double precision,
  add column if not exists beds int,
  add column if not exists baths int;

-- =========================
-- SMART NOTIFICATIONS
-- =========================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid,
  property_id uuid,
  type text not null,
  message text not null,
  sent_at timestamptz not null default now()
);

create index if not exists idx_notifications_lead_id_sent_at on public.notifications(lead_id, sent_at desc);
create index if not exists idx_notifications_property_id_type on public.notifications(property_id, type);

