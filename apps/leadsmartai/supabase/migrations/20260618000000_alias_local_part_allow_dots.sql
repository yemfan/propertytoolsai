-- Widen the agent_inbound_aliases local_part check constraint to
-- accept dots. This unblocks email-derived friendly aliases — e.g.
-- the agent who logs in as `fan.yes@gmail.com` can have a forwarding
-- address `fan.yes@inbox.leadsmart-ai.com` instead of the opaque
-- `agent-b9a798@…` we generated before.
--
-- Existing rule kept as-is: must start AND end with [a-z0-9], length
-- 4-64. Just adding `.` to the middle character class.
--
-- We do NOT enforce "no consecutive dots" at the DB layer — RFC 5322
-- forbids it but most providers accept it, and our slug derivation
-- collapses dots before insert anyway. Keeping the constraint
-- minimal so legitimate addresses (`first.middle.last`) aren't
-- rejected.

alter table public.agent_inbound_aliases
  drop constraint if exists agent_inbound_aliases_local_part_format;

alter table public.agent_inbound_aliases
  add constraint agent_inbound_aliases_local_part_format check (
    local_part ~ '^[a-z0-9][a-z0-9.\-]{2,62}[a-z0-9]$'
  );
