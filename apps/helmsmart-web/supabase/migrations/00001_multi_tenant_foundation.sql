-- ─── Multi-tenant foundation ──────────────────────────────────────────────────
-- Every table in smbai is scoped to an organization_id.
-- RLS is enforced on all tables — service role bypasses for server mutations.
--
-- Tenant model:
--   auth.users (Supabase managed)
--     └── organization_members  (user ↔ org, with role)
--           └── organizations   (the business entity)

-- Organizations
create table if not exists organizations (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  slug                  text unique not null,
  entity_type           text not null default 'sole_prop'
                          check (entity_type in ('sole_prop','llc','s_corp','c_corp','partnership')),
  fiscal_year_end_month integer not null default 12
                          check (fiscal_year_end_month between 1 and 12),
  accounting_basis      text not null default 'cash'
                          check (accounting_basis in ('cash','accrual')),
  currency              text not null default 'USD',
  timezone              text not null default 'America/New_York',
  stripe_customer_id    text,
  plan                  text not null default 'starter'
                          check (plan in ('starter','growth','pro')),
  subscription_status   text not null default 'trialing',
  trial_ends_at         timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Members (user ↔ org with role)
create table if not exists organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'owner'
                    check (role in ('owner','admin','bookkeeper','viewer')),
  invited_by      uuid references auth.users(id),
  joined_at       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- Immutable audit log (only service role may insert)
create table if not exists audit_log (
  id              bigserial primary key,
  organization_id uuid not null references organizations(id),
  user_id         uuid references auth.users(id),
  action          text not null,
  table_name      text not null,
  record_id       text,
  old_data        jsonb,
  new_data        jsonb,
  ip_address      text,
  created_at      timestamptz not null default now()
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table organizations        enable row level security;
alter table organization_members enable row level security;
alter table audit_log            enable row level security;

-- Helper: returns the set of org IDs the current user belongs to.
-- SECURITY DEFINER so it can query organization_members without infinite recursion.
create or replace function get_user_org_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select organization_id
  from   organization_members
  where  user_id = auth.uid()
$$;

-- organizations
create policy "members can view their orgs"
  on organizations for select
  using (id in (select get_user_org_ids()));

create policy "owners/admins can update their orgs"
  on organizations for update
  using (
    id in (
      select organization_id from organization_members
      where  user_id = auth.uid()
      and    role in ('owner','admin')
    )
  );

create policy "authenticated users can create orgs"
  on organizations for insert
  with check (auth.uid() is not null);

-- organization_members
create policy "members can view their org roster"
  on organization_members for select
  using (organization_id in (select get_user_org_ids()));

create policy "owners/admins can manage members"
  on organization_members for all
  using (
    organization_id in (
      select organization_id from organization_members
      where  user_id = auth.uid()
      and    role in ('owner','admin')
    )
  );

create policy "users can insert themselves as member"
  on organization_members for insert
  with check (user_id = auth.uid());

-- audit_log (read-only for members; writes via service role only)
create policy "members can read their org audit log"
  on audit_log for select
  using (organization_id in (select get_user_org_ids()));

-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists idx_org_members_user_id
  on organization_members(user_id);
create index if not exists idx_org_members_org_id
  on organization_members(organization_id);
create index if not exists idx_audit_log_org_created
  on audit_log(organization_id, created_at desc);

-- ─── Shared trigger: updated_at ───────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_updated_at
  before update on organizations
  for each row execute function set_updated_at();
