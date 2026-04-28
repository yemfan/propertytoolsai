-- Allow team members to have role='isa' (Inside Sales Agent).
--
-- The team-accounts schema (#189) shipped with role enum
-- {'owner','member'}. ISA workflows need a third role so the
-- lead-routing layer can:
--   1. Send every new lead to an ISA first (round-robin within
--      role='isa')
--   2. Once the ISA qualifies it, hand off to a 'member'
--      (closing agent)
--
-- Closer = non-ISA team member. We don't introduce a 'closer'
-- role explicitly — 'member' covers it. Owners can also act
-- as closers.
--
-- This migration relaxes the CHECK constraint to include 'isa'.
-- Existing 'owner'/'member' rows remain valid.

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'team_memberships'
  ) then
    -- Drop the old check constraint by name. The original migration
    -- generated an unnamed constraint, so postgres named it
    -- `team_memberships_role_check`.
    execute 'alter table public.team_memberships drop constraint if exists team_memberships_role_check';
    execute $sql$
      alter table public.team_memberships
      add constraint team_memberships_role_check
        check (role in ('owner','member','isa'))
    $sql$;
  end if;
end $$;

comment on column public.team_memberships.role is
  'Role within the team: owner (full control) | member (default closer) | isa (Inside Sales Agent — first-touch lead qualification, hands off to a member after qualifying).';
