-- AI deal-review cache. When an agent opens a CLOSED transaction and
-- asks for a post-mortem, we feed a structured snapshot to Claude and
-- cache the generated review here. Closed deals don't change, so the
-- cache never expires — but a "Regenerate" button can overwrite.
--
-- `payload` is a jsonb of { summary, whatWentWell, whereItStalled,
-- doDifferentlyNextTime, ... } — shape defined in lib/deal-review/types.ts.
-- If the schema evolves, bump a version field inside the payload;
-- wiping the cache table is a safe last resort.

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
      create table if not exists public.transaction_reviews (
        transaction_id uuid primary key references public.transactions(id) on delete cascade,
        agent_id uuid not null references public.agents(id) on delete cascade,
        payload jsonb not null,
        generated_at timestamptz not null default now()
      )
    $sql$;
  else
    execute $sql$
      create table if not exists public.transaction_reviews (
        transaction_id uuid primary key references public.transactions(id) on delete cascade,
        agent_id bigint not null references public.agents(id) on delete cascade,
        payload jsonb not null,
        generated_at timestamptz not null default now()
      )
    $sql$;
  end if;
end $$;

create index if not exists idx_transaction_reviews_agent
  on public.transaction_reviews (agent_id, generated_at desc);

comment on table public.transaction_reviews is
  'Claude-generated post-close debrief per transaction. One row per transaction (transaction_id PK). Regeneration overwrites.';
