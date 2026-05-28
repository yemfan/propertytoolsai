-- Fix: infinite recursion (Postgres 42P17) in organization_members RLS.
--
-- The "owners/admins can manage members" ALL policy on organization_members,
-- and the "owners/admins can update their orgs" UPDATE policy on organizations,
-- both checked admin membership with a DIRECT subquery on organization_members.
-- Because that subquery is itself subject to organization_members' RLS,
-- evaluating the policy re-enters the same policy → infinite recursion. This
-- broke any UPDATE on organizations (e.g. saving Settings) and any direct
-- read/manage of organization_members (e.g. the team roster).
--
-- Fix: route the admin-membership check through a SECURITY DEFINER function —
-- the same pattern the working SELECT policies already use via
-- get_user_org_ids() — which bypasses RLS internally and breaks the cycle.
-- Access intent is unchanged: only an org's owners/admins can manage its
-- members or update the org.

create or replace function public.get_user_admin_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from organization_members
  where user_id = auth.uid()
    and role in ('owner', 'admin')
$$;

-- organization_members — replace the self-referential ALL policy.
drop policy if exists "owners/admins can manage members" on organization_members;
create policy "owners/admins can manage members"
  on organization_members
  for all
  using (organization_id in (select get_user_admin_org_ids()));

-- organizations — replace the recursive UPDATE policy.
drop policy if exists "owners/admins can update their orgs" on organizations;
create policy "owners/admins can update their orgs"
  on organizations
  for update
  using (id in (select get_user_admin_org_ids()));
