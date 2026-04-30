-- marketing_plans had a bigint `lead_id` column from before the leads → contacts
-- rename. Code now writes/reads `contact_id` (uuid) so the missing column was
-- breaking plan creation with "Could not find the 'contact_id' column ... in
-- the schema cache".
--
-- Add `contact_id uuid` referencing contacts(id). Keep `lead_id` for now —
-- it's unused but holding bigints from pre-rename data; a follow-up sweep
-- can drop it once we're confident nothing reads it. ON DELETE SET NULL so
-- a deleted contact doesn't cascade-drop their marketing plan history.
--
-- Already applied to production via Supabase MCP on 2026-04-30; this file
-- exists so the migration history in the repo matches what the prod
-- database actually has.

alter table public.marketing_plans
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

create index if not exists idx_marketing_plans_contact_id
  on public.marketing_plans(contact_id);

comment on column public.marketing_plans.contact_id is
  'FK to public.contacts(id). Replaces legacy bigint lead_id; lead_id is left in place for now and unused.';
