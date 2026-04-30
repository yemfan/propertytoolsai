-- Per-agent social connections + post audit log.
--
-- v1 scope: Facebook Page posting only. The schema is provider-agnostic
-- (provider text + provider_account_id text) so adding Instagram or
-- LinkedIn later is a TS-side change, not a migration.
--
-- agent_social_connections: one row per (agent, provider, account).
--   An agent can connect MULTIPLE FB pages; each is a row. The picker on
--   the post UI lets the agent choose which page to post to. RLS is
--   strict — only the owning agent reads/writes their own rows.
--
-- social_post_log: every post attempt, success or failure. Append-only;
--   feeds the audit / "did this go through?" panel on the transaction
--   detail page. No cascade-delete to transactions because the audit
--   should outlive the deal.
--
-- agent_id type follows public.agents.id (uuid OR bigint) — same
-- pattern as 20260512000000_agent_sphere_drip_prefs.sql.

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
      create table if not exists public.agent_social_connections (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        provider text not null check (provider in ('facebook_page')),
        provider_account_id text not null,
        provider_account_name text,
        access_token text not null,
        token_expires_at timestamptz,
        scopes text[] not null default '{}',
        connected_at timestamptz not null default now(),
        last_used_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id, provider, provider_account_id)
      )
    $sql$;

    execute $sql$
      create table if not exists public.social_post_log (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        connection_id uuid references public.agent_social_connections(id) on delete set null,
        provider text not null,
        provider_account_id text,
        provider_post_id text,
        transaction_id uuid references public.transactions(id) on delete set null,
        caption text,
        status text not null check (status in ('pending', 'sent', 'failed')),
        error text,
        created_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.agent_social_connections (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        provider text not null check (provider in ('facebook_page')),
        provider_account_id text not null,
        provider_account_name text,
        access_token text not null,
        token_expires_at timestamptz,
        scopes text[] not null default '{}',
        connected_at timestamptz not null default now(),
        last_used_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (agent_id, provider, provider_account_id)
      )
    $sql$;

    execute $sql$
      create table if not exists public.social_post_log (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        connection_id uuid references public.agent_social_connections(id) on delete set null,
        provider text not null,
        provider_account_id text,
        provider_post_id text,
        transaction_id uuid references public.transactions(id) on delete set null,
        caption text,
        status text not null check (status in ('pending', 'sent', 'failed')),
        error text,
        created_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.agent_social_connections is
  'OAuth credentials for posting to social platforms on behalf of an agent. v1 supports Facebook Pages; the provider column is open-ended for future Instagram / LinkedIn additions.';

comment on column public.agent_social_connections.access_token is
  'Long-lived FB Page access token (60-day rolling). Never returned to the client; only the server uses it to call the Graph API. RLS prevents cross-agent reads.';

comment on column public.agent_social_connections.revoked_at is
  'Set when the agent disconnects the account. Disconnect sets the timestamp without deleting the row, so the social_post_log audit trail still resolves the connection_id FK.';

comment on table public.social_post_log is
  'Append-only audit of every post attempt. status=pending is a defensive default; the post helper updates to sent/failed before returning to the caller.';

-- ── triggers ────────────────────────────────────────────────────

create or replace function public.set_agent_social_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agent_social_connections_set_updated_at on public.agent_social_connections;
create trigger agent_social_connections_set_updated_at
  before update on public.agent_social_connections
  for each row execute procedure public.set_agent_social_connections_updated_at();

-- ── indexes ─────────────────────────────────────────────────────

create index if not exists idx_agent_social_connections_agent_active
  on public.agent_social_connections (agent_id, provider)
  where revoked_at is null;

create index if not exists idx_social_post_log_agent_created
  on public.social_post_log (agent_id, created_at desc);

create index if not exists idx_social_post_log_transaction
  on public.social_post_log (transaction_id, created_at desc)
  where transaction_id is not null;

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.agent_social_connections enable row level security;

drop policy if exists "agent_social_connections_select_own" on public.agent_social_connections;
create policy "agent_social_connections_select_own"
  on public.agent_social_connections
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_social_connections.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "agent_social_connections_insert_own" on public.agent_social_connections;
create policy "agent_social_connections_insert_own"
  on public.agent_social_connections
  for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = agent_social_connections.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "agent_social_connections_update_own" on public.agent_social_connections;
create policy "agent_social_connections_update_own"
  on public.agent_social_connections
  for update
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_social_connections.agent_id
        and agents.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agents
      where agents.id = agent_social_connections.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "agent_social_connections_delete_own" on public.agent_social_connections;
create policy "agent_social_connections_delete_own"
  on public.agent_social_connections
  for delete
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_social_connections.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

-- social_post_log is append-only from the agent's perspective; reads
-- only. The server writes via service-role to bypass RLS for inserts.
alter table public.social_post_log enable row level security;

drop policy if exists "social_post_log_select_own" on public.social_post_log;
create policy "social_post_log_select_own"
  on public.social_post_log
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = social_post_log.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );
