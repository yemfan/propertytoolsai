-- Custom fields on contacts.
--
-- Closes the "custom fields on contacts" gap from the analysis.
-- Each agent (or team owner, on behalf of the team's roster)
-- defines fields like "Budget", "Pre-approval lender", "Best
-- school district preference" and the values get stored on
-- contacts.custom_fields (jsonb).
--
-- Why JSONB rather than a normalized field-values table:
--   - Single read returns the full contact + all custom values
--     (no extra join hop)
--   - GIN index can be added later if filter-by-custom-field
--     becomes a hot query
--   - Type validation lives at the app layer (per-field-type
--     coercion in lib/contact-fields/values.ts)
--
-- agent_id type adapts to public.agents.id (uuid OR bigint).

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
      create table if not exists public.agent_contact_field_defs (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        -- Stable identifier used in contacts.custom_fields[].
        -- Snake_case, no spaces. Unique per-agent.
        field_key text not null,
        label text not null,
        field_type text not null check (field_type in (
          'text','longtext','number','boolean','date','select','multiselect'
        )),
        -- For select / multiselect: array of {value, label} pairs.
        -- Ignored on other types.
        options jsonb not null default '[]'::jsonb,
        is_required boolean not null default false,
        sort_order int not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id, field_key)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.agent_contact_field_defs (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        field_key text not null,
        label text not null,
        field_type text not null check (field_type in (
          'text','longtext','number','boolean','date','select','multiselect'
        )),
        options jsonb not null default '[]'::jsonb,
        is_required boolean not null default false,
        sort_order int not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id, field_key)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

-- Add custom_fields jsonb to contacts. Nullable + default empty
-- object so existing rows are unaffected.
alter table if exists public.contacts
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

comment on table public.agent_contact_field_defs is
  'Per-agent custom field definitions for the contacts surface. Values land in contacts.custom_fields keyed by field_key.';
comment on column public.agent_contact_field_defs.field_key is
  'Snake_case stable id, unique per agent. Used as the JSON key in contacts.custom_fields.';
comment on column public.agent_contact_field_defs.options is
  'For select/multiselect types: [{value, label}, ...]. Empty array on other types.';
comment on column public.contacts.custom_fields is
  'Bag of agent-defined field values. Keys must match agent_contact_field_defs.field_key for the contact''s agent. App layer validates types.';

-- ── trigger: keep updated_at fresh ─────────────────────────────

create or replace function public.set_agent_contact_field_defs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agent_contact_field_defs_set_updated_at on public.agent_contact_field_defs;
create trigger agent_contact_field_defs_set_updated_at
  before update on public.agent_contact_field_defs
  for each row execute procedure public.set_agent_contact_field_defs_updated_at();

-- ── indexes ─────────────────────────────────────────────────────

create index if not exists idx_field_defs_agent_sort
  on public.agent_contact_field_defs (agent_id, sort_order);

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.agent_contact_field_defs enable row level security;

drop policy if exists "field_defs_select_own" on public.agent_contact_field_defs;
create policy "field_defs_select_own"
  on public.agent_contact_field_defs
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_contact_field_defs.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "field_defs_insert_own" on public.agent_contact_field_defs;
create policy "field_defs_insert_own"
  on public.agent_contact_field_defs
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = agent_contact_field_defs.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "field_defs_update_own" on public.agent_contact_field_defs;
create policy "field_defs_update_own"
  on public.agent_contact_field_defs
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_contact_field_defs.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = agent_contact_field_defs.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "field_defs_delete_own" on public.agent_contact_field_defs;
create policy "field_defs_delete_own"
  on public.agent_contact_field_defs
  for delete
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_contact_field_defs.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );
