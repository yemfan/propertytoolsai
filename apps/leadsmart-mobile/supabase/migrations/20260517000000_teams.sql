-- Team accounts foundation.
--
-- Phase 1 of the multi-PR rollout to support brokerages: a team has
-- one owner and zero-or-more members. Members are also agents — one
-- agent can be in multiple teams (e.g. a buyer-side and listing-side
-- group at the same brokerage).
--
-- This migration only creates the data model. Subsequent PRs:
--   - PR-AA2 wires read queries to use a team-aware scope helper
--   - PR-AA3 ships the team management UI
--   - PR-AA4 routes leads across team rosters
--   - PR-AA5 wires entitlements + Stripe team plans
--   - PR-AA6 adds team-aggregated reporting
--
-- Three tables:
--   - teams: one row per team, owned by exactly one agent
--   - team_memberships: many-to-many between teams and agents (the
--     owner has a row too with role='owner', so "list all members"
--     is one query)
--   - team_invites: pending invitations keyed by invitee email + a
--     signed token. Distinct from memberships so we don't have a
--     nullable agent_id on the membership table — cleaner lifecycle
--
-- agent_id type adapts to public.agents.id (uuid OR bigint), same
-- pattern as 20260514000000_agent_social_connections.sql,
-- 20260515000000_coaching_dismissals.sql,
-- 20260516000000_email_events.sql.

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
      create table if not exists public.teams (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        owner_agent_id uuid not null references public.agents(id) on delete cascade,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.team_memberships (
        team_id uuid not null references public.teams(id) on delete cascade,
        agent_id uuid not null references public.agents(id) on delete cascade,
        role text not null default 'member' check (role in ('owner','member')),
        created_at timestamptz not null default now(),
        primary key (team_id, agent_id)
      )
    $sql$;

    execute $sql$
      create table if not exists public.team_invites (
        id uuid primary key default gen_random_uuid(),
        team_id uuid not null references public.teams(id) on delete cascade,
        invited_email text not null,
        -- Cryptographically-random token; the accept URL embeds it.
        -- Service layer hashes before comparing on accept to avoid
        -- timing attacks. (Stored hashed; raw token only emailed.)
        token_hash text not null,
        invited_by_agent_id uuid not null references public.agents(id) on delete cascade,
        expires_at timestamptz not null,
        accepted_at timestamptz null,
        accepted_by_agent_id uuid null references public.agents(id) on delete set null,
        created_at timestamptz not null default now(),
        unique (team_id, invited_email)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.teams (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        owner_agent_id bigint not null references public.agents(id) on delete cascade,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    execute $sql$
      create table if not exists public.team_memberships (
        team_id uuid not null references public.teams(id) on delete cascade,
        agent_id bigint not null references public.agents(id) on delete cascade,
        role text not null default 'member' check (role in ('owner','member')),
        created_at timestamptz not null default now(),
        primary key (team_id, agent_id)
      )
    $sql$;

    execute $sql$
      create table if not exists public.team_invites (
        id uuid primary key default gen_random_uuid(),
        team_id uuid not null references public.teams(id) on delete cascade,
        invited_email text not null,
        token_hash text not null,
        invited_by_agent_id bigint not null references public.agents(id) on delete cascade,
        expires_at timestamptz not null,
        accepted_at timestamptz null,
        accepted_by_agent_id bigint null references public.agents(id) on delete set null,
        created_at timestamptz not null default now(),
        unique (team_id, invited_email)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.teams is
  'Brokerage / agent-team grouping. One owner agent + many members. Owner also has a row in team_memberships (role=owner) so member queries are one table.';

comment on column public.team_invites.token_hash is
  'SHA-256 hex of the raw invite token. Raw token only ever leaves the server in the invite email; verification compares hashes.';

-- ── trigger: keep teams.updated_at fresh ────────────────────────

create or replace function public.set_teams_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at
  before update on public.teams
  for each row execute procedure public.set_teams_updated_at();

-- ── trigger: when a team is created, insert the owner's membership ──

create or replace function public.add_owner_team_membership()
returns trigger
language plpgsql
as $$
begin
  insert into public.team_memberships(team_id, agent_id, role)
  values (new.id, new.owner_agent_id, 'owner')
  on conflict (team_id, agent_id) do nothing;
  return new;
end;
$$;

drop trigger if exists teams_add_owner_membership on public.teams;
create trigger teams_add_owner_membership
  after insert on public.teams
  for each row execute procedure public.add_owner_team_membership();

-- ── indexes ─────────────────────────────────────────────────────

-- "give me every team I'm a member of"
create index if not exists idx_team_memberships_agent
  on public.team_memberships (agent_id);

-- "give me the roster of this team"
create index if not exists idx_team_memberships_team
  on public.team_memberships (team_id);

-- "is there a pending invite for this email?"
create index if not exists idx_team_invites_email_pending
  on public.team_invites (invited_email)
  where accepted_at is null;

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.team_invites enable row level security;

-- Helper: is the calling agent the owner of <team_id>?
create or replace function public.is_team_owner(p_team_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.teams t
    join public.agents a on a.id = t.owner_agent_id
    where t.id = p_team_id
      and a.auth_user_id = auth.uid()
  );
$$;

-- Helper: is the calling agent a member (any role) of <team_id>?
create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.team_memberships tm
    join public.agents a on a.id = tm.agent_id
    where tm.team_id = p_team_id
      and a.auth_user_id = auth.uid()
  );
$$;

-- ── teams policies ──────────────────────────────────────────────

drop policy if exists "teams_select_member" on public.teams;
create policy "teams_select_member"
  on public.teams
  for select
  using (public.is_team_member(id));

drop policy if exists "teams_insert_self_as_owner" on public.teams;
create policy "teams_insert_self_as_owner"
  on public.teams
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = teams.owner_agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "teams_update_owner" on public.teams;
create policy "teams_update_owner"
  on public.teams
  for update
  using (public.is_team_owner(id))
  with check (public.is_team_owner(id));

drop policy if exists "teams_delete_owner" on public.teams;
create policy "teams_delete_owner"
  on public.teams
  for delete
  using (public.is_team_owner(id));

-- ── team_memberships policies ───────────────────────────────────

-- Members can read their team's full roster (so they know who else is on the team).
drop policy if exists "team_memberships_select_team_members" on public.team_memberships;
create policy "team_memberships_select_team_members"
  on public.team_memberships
  for select
  using (public.is_team_member(team_id));

-- Only the owner can add or remove members directly. (Membership is
-- normally added via accepting an invite, which runs through the
-- service-role server path; this insert policy covers manual
-- direct-add by the owner from a future admin UI.)
drop policy if exists "team_memberships_insert_owner" on public.team_memberships;
create policy "team_memberships_insert_owner"
  on public.team_memberships
  for insert
  with check (public.is_team_owner(team_id));

drop policy if exists "team_memberships_delete_owner" on public.team_memberships;
create policy "team_memberships_delete_owner"
  on public.team_memberships
  for delete
  using (public.is_team_owner(team_id));

-- ── team_invites policies ───────────────────────────────────────

-- Owners see all invites for their team. Members can also see them
-- (so the roster page reads coherently). Invitees never see anything
-- via the agent client — accept-by-token flow goes through the
-- service-role webhook path.
drop policy if exists "team_invites_select_member" on public.team_invites;
create policy "team_invites_select_member"
  on public.team_invites
  for select
  using (public.is_team_member(team_id));

drop policy if exists "team_invites_insert_owner" on public.team_invites;
create policy "team_invites_insert_owner"
  on public.team_invites
  for insert
  with check (public.is_team_owner(team_id));

drop policy if exists "team_invites_delete_owner" on public.team_invites;
create policy "team_invites_delete_owner"
  on public.team_invites
  for delete
  using (public.is_team_owner(team_id));
