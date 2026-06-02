-- ─── HelmSmart V2 tenancy ──────────────────────────────────────────────────────
-- Extends smbai's org model to the 5-level target:
--   tenant_id > organization_id > workspace_id > user_id + role + permissions
--
-- ADDITIVE + nullable-defaulted. smbai's organizations/organization_members stay the
-- load-bearing middle layer; nothing is dropped or renamed. The default SMB remains
-- 1 tenant : 1 org : 1 workspace (tenant_id / workspace_id NULL == "the org itself").
--
-- Reuses helpers from 00001_multi_tenant_foundation: set_updated_at(), get_user_org_ids().
-- See Tenancy_Migration_Plan_v2.md.

-- ── LEVEL 1: tenants (billing / parent account: brokerage, agency, FMO, franchise) ──
create table if not exists tenants (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  slug               text unique not null,
  kind               text not null default 'single'
                       check (kind in ('single','brokerage','agency','franchise','fmo','enterprise')),
  stripe_customer_id text,
  plan               text not null default 'starter',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- organizations gain an OPTIONAL parent tenant (NULL => standalone org / implicit single tenant)
alter table organizations
  add column if not exists tenant_id uuid references tenants(id) on delete set null;

-- ── LEVEL 3: workspaces (sub-unit inside an org: team, department, branch, location) ──
create table if not exists workspaces (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  slug            text not null,
  kind            text not null default 'team'
                    check (kind in ('team','department','branch','location','general')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, slug)
);

-- membership can be scoped to a workspace (NULL => org-wide member)
alter table organization_members
  add column if not exists workspace_id uuid references workspaces(id) on delete set null;

-- ── indexes ─────────────────────────────────────────────────────────────────────
create index if not exists idx_organizations_tenant   on organizations(tenant_id);
create index if not exists idx_workspaces_org          on workspaces(organization_id);
create index if not exists idx_org_members_workspace   on organization_members(workspace_id);

-- ── updated_at triggers (set_updated_at from 00001) ───────────────────────────────
create or replace trigger tenants_updated_at
  before update on tenants    for each row execute function set_updated_at();
create or replace trigger workspaces_updated_at
  before update on workspaces  for each row execute function set_updated_at();

-- ── scope helpers (SECURITY DEFINER, mirror get_user_org_ids) ─────────────────────
-- tenants the user can reach = tenants that parent an org the user belongs to
create or replace function get_user_tenant_ids()
returns setof uuid language sql security definer stable as $$
  select distinct o.tenant_id
  from   organizations o
  join   organization_members m on m.organization_id = o.id
  where  m.user_id = auth.uid() and o.tenant_id is not null
$$;

-- workspaces the user can reach = workspaces in orgs the user belongs to
create or replace function get_user_workspace_ids()
returns setof uuid language sql security definer stable as $$
  select w.id
  from   workspaces w
  join   organization_members m on m.organization_id = w.organization_id
  where  m.user_id = auth.uid()
$$;

-- unified scope: org stays the default working unit; tenant is roll-up context
create or replace function get_user_scope()
returns table (organization_id uuid, tenant_id uuid)
language sql security definer stable as $$
  select o.id, o.tenant_id
  from   organizations o
  join   organization_members m on m.organization_id = o.id
  where  m.user_id = auth.uid()
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────────
alter table tenants    enable row level security;
alter table workspaces enable row level security;

drop policy if exists "members can view their tenants" on tenants;
create policy "members can view their tenants"
  on tenants for select
  using (id in (select get_user_tenant_ids()));

drop policy if exists "tenant owners/admins can update their tenant" on tenants;
create policy "tenant owners/admins can update their tenant"
  on tenants for update
  using (
    id in (
      select o.tenant_id
      from   organizations o
      join   organization_members m on m.organization_id = o.id
      where  m.user_id = auth.uid() and m.role in ('owner','admin') and o.tenant_id is not null
    )
  );

drop policy if exists "members can view their org workspaces" on workspaces;
create policy "members can view their org workspaces"
  on workspaces for select
  using (organization_id in (select get_user_org_ids()));

drop policy if exists "org owners/admins manage workspaces" on workspaces;
create policy "org owners/admins manage workspaces"
  on workspaces for all
  using (
    organization_id in (
      select organization_id from organization_members
      where  user_id = auth.uid() and role in ('owner','admin')
    )
  );
