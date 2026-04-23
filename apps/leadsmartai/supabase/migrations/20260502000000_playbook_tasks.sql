-- Playbook tasks — curated checklists applied to a transaction, open
-- house, contact, or a bare anchor date. Templates themselves live in
-- TypeScript (lib/playbooks/definitions.ts) — static, code-managed, so
-- new agents get updates the instant we deploy. This table stores
-- only the per-agent INSTANCES created when a playbook is applied.
--
-- Anchor polymorphism: `anchor_kind` tells us which entity `anchor_id`
-- points at. Foreign-key enforcement is application-level (anchor
-- could be null for 'generic' bare-date anchors).

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
      create table if not exists public.playbook_task_instances (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,

        -- Anchor. 'generic' means no linked entity (bare checklist).
        anchor_kind text not null
          check (anchor_kind in ('transaction', 'open_house', 'contact', 'generic')),
        anchor_id uuid,

        -- Template provenance. NULL if the agent added a custom task
        -- not generated from a playbook.
        template_key text,
        -- All rows generated from one "apply playbook" click share this
        -- batch id — lets us render a per-playbook panel and offer
        -- "remove whole playbook" as one action.
        apply_batch_id uuid,

        title text not null,
        notes text,
        -- Section label (e.g. "Before open house" / "Day of" / "After")
        -- — purely for grouping in the UI.
        section text,

        -- Relative offset stored alongside absolute due_date so we can
        -- re-compute after an anchor date change.
        offset_days integer,
        due_date date,

        completed_at timestamptz,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.playbook_task_instances (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,

        anchor_kind text not null
          check (anchor_kind in ('transaction', 'open_house', 'contact', 'generic')),
        anchor_id uuid,

        template_key text,
        apply_batch_id uuid,

        title text not null,
        notes text,
        section text,

        offset_days integer,
        due_date date,

        completed_at timestamptz,

        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  end if;
end $$;

-- List-by-anchor: the hot query pattern (detail pages render their
-- anchor's instances). Partial index on (completed_at is null) keeps
-- the "open tasks" query fast as historical tasks accumulate.
create index if not exists idx_playbook_tasks_agent_anchor
  on public.playbook_task_instances (agent_id, anchor_kind, anchor_id);

create index if not exists idx_playbook_tasks_open
  on public.playbook_task_instances (agent_id, due_date)
  where completed_at is null;

-- Group by batch for "applied playbook" chip rendering.
create index if not exists idx_playbook_tasks_batch
  on public.playbook_task_instances (apply_batch_id)
  where apply_batch_id is not null;
