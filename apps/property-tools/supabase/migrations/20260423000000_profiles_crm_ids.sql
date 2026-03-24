-- Optional CRM linkage ids on `public.profiles` (text to match bigint/uuid string storage in app code).
-- Existing table keeps: `id` → auth.users, `profiles_role_check` includes `consumer`.

alter table public.profiles
  add column if not exists agent_id text null,
  add column if not exists broker_id text null,
  add column if not exists support_id text null;

comment on column public.profiles.agent_id is
  'CRM `public.agents.id` as text when linked; used for lead scoping.';

comment on column public.profiles.broker_id is
  'CRM loan broker id when linked (e.g. `loan_brokers.id`).';

comment on column public.profiles.support_id is
  'Support staff id when linked (e.g. support inbox routing).';
