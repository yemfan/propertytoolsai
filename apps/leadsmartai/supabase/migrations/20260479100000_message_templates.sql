-- Message Template Library + per-agent overrides.
-- Seeded from apps/propertytoolsai/docs/proptotypes/leadsmart/leadsmart-handoff/03-template-library/leadsmart-template-library.json.
-- Schema per §03-template-library handoff, extended with `language` and `variant_of`
-- so bilingual + email-paired-with-SMS variants can be stored alongside the parent.

create table if not exists public.templates (
  id text primary key,
  category text not null check (category in ('sphere', 'lead_response', 'lifecycle')),
  name text not null,
  channel text not null check (channel in ('sms', 'email')),
  subject text null,
  body text not null,
  language text not null default 'en' check (language in ('en', 'zh')),
  variant_of text null references public.templates(id),
  placeholders jsonb not null default '[]'::jsonb,
  trigger_config jsonb not null default '{}'::jsonb,
  notes text null,
  default_status text not null default 'review'
    check (default_status in ('autosend', 'review', 'off')),
  -- source: 'spec' = from §2.5 verbatim, 'spec_expanded' = extended spec,
  -- 'invented' = entirely new (needs product validation before launch).
  source text not null default 'invented'
    check (source in ('spec', 'spec_expanded', 'invented')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_templates_category on public.templates(category);
create index if not exists idx_templates_channel  on public.templates(channel);
create index if not exists idx_templates_variant_of on public.templates(variant_of);

-- Per-agent overrides. Base templates are never mutated; edits land here.
do $$
declare
  v_agent_type text;
begin
  select a.atttypid::regtype::text
    into v_agent_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'agents' and a.attname = 'id'
    and a.attnum > 0 and not a.attisdropped
  limit 1;

  if v_agent_type is null then
    raise exception 'public.agents.id not found';
  end if;

  if v_agent_type = 'uuid' then
    execute $sql$
      create table if not exists public.template_overrides (
        agent_id uuid not null references public.agents(id) on delete cascade,
        template_id text not null references public.templates(id) on delete cascade,
        status text not null default 'review'
          check (status in ('autosend', 'review', 'off')),
        subject_override text null,
        body_override text null,
        edited boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (agent_id, template_id)
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.template_overrides (
        agent_id bigint not null references public.agents(id) on delete cascade,
        template_id text not null references public.templates(id) on delete cascade,
        status text not null default 'review'
          check (status in ('autosend', 'review', 'off')),
        subject_override text null,
        body_override text null,
        edited boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (agent_id, template_id)
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type for template_overrides: %', v_agent_type;
  end if;
end $$;

create index if not exists idx_template_overrides_agent
  on public.template_overrides(agent_id);
create index if not exists idx_template_overrides_template
  on public.template_overrides(template_id);

comment on table public.templates is
  'Base message library. Seeded from the handoff JSON — 20 templates across sphere, lead_response, lifecycle. Do not mutate at runtime; per-agent edits land in template_overrides.';
comment on table public.template_overrides is
  'Per-agent template status + body/subject overrides. Null overrides inherit from the base template.';
