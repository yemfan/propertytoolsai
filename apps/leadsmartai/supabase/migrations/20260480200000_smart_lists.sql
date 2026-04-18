-- Contacts consolidation — Part 3 of 3: Smart Lists.
--
-- FUB/kvCORE pattern: agents save named filters over the contacts table.
-- Three defaults ship with every new agent (Leads, Sphere, All) but agents
-- can add, rename, reorder, and delete their own. System defaults can be
-- hidden but not deleted.

create table public.smart_lists (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,

  name text not null,
  description text,
  icon text,                       -- optional lucide-react icon name for sidebar chip

  -- Filter shape (validated app-side, not in DB):
  --   {
  --     "lifecycle_stage": ["lead","active_client"],
  --     "rating": ["A","B"],
  --     "source": ["Zillow"],
  --     "has_signals": true,
  --     "dormant_days_gte": 90,
  --     "updated_within_days": 30,
  --     "query": "free text"
  --   }
  filter_config jsonb not null default '{}'::jsonb,

  sort_order integer not null default 0,

  -- System defaults (Leads / Sphere / All) seeded per-agent. Agents can
  -- hide them (is_hidden) but not delete, so the base segmentation stays
  -- consistent across the product.
  is_default boolean not null default false,
  is_hidden boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (agent_id, name)
);

create index idx_smart_lists_agent_sort on public.smart_lists(agent_id, sort_order);


-- Seed three defaults for every existing agent
insert into public.smart_lists (agent_id, name, description, filter_config, sort_order, is_default)
select
  a.id,
  'Leads',
  'Active pipeline — new inquiries and in-progress deals.',
  '{"lifecycle_stage":["lead","active_client"]}'::jsonb,
  0,
  true
from public.agents a
on conflict (agent_id, name) do nothing;

insert into public.smart_lists (agent_id, name, description, filter_config, sort_order, is_default)
select
  a.id,
  'Sphere',
  'Past clients, referral sources, and non-client sphere contacts.',
  '{"lifecycle_stage":["past_client","sphere","referral_source"]}'::jsonb,
  1,
  true
from public.agents a
on conflict (agent_id, name) do nothing;

insert into public.smart_lists (agent_id, name, description, filter_config, sort_order, is_default)
select
  a.id,
  'All contacts',
  'Every contact except archived.',
  '{"exclude_lifecycle_stage":["archived"]}'::jsonb,
  2,
  true
from public.agents a
on conflict (agent_id, name) do nothing;


-- When a new agent is created, auto-seed the three defaults.
create or replace function public.seed_default_smart_lists()
returns trigger language plpgsql as $$
begin
  insert into public.smart_lists (agent_id, name, description, filter_config, sort_order, is_default)
  values
    (new.id, 'Leads',
     'Active pipeline — new inquiries and in-progress deals.',
     '{"lifecycle_stage":["lead","active_client"]}'::jsonb,
     0, true),
    (new.id, 'Sphere',
     'Past clients, referral sources, and non-client sphere contacts.',
     '{"lifecycle_stage":["past_client","sphere","referral_source"]}'::jsonb,
     1, true),
    (new.id, 'All contacts',
     'Every contact except archived.',
     '{"exclude_lifecycle_stage":["archived"]}'::jsonb,
     2, true)
  on conflict (agent_id, name) do nothing;
  return new;
end
$$;

drop trigger if exists trg_agents_seed_smart_lists on public.agents;
create trigger trg_agents_seed_smart_lists
  after insert on public.agents
  for each row execute function public.seed_default_smart_lists();


-- updated_at trigger
create or replace function public.touch_smart_lists_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger trg_smart_lists_updated_at
  before update on public.smart_lists
  for each row execute function public.touch_smart_lists_updated_at();
