-- Review / testimonial capture.
--
-- Closes the "reviews / testimonial capture" gap. After a
-- transaction closes, the system sends the client a request
-- with two paths:
--   1. Click → leave a Google review (external link)
--   2. Submit a private testimonial (rating + comment) the agent
--      can later use as marketing copy
--
-- Two tables:
--   - review_requests: one row per (agent, contact) pair we asked
--     for a review. Tokenized public link, expires_at gates abuse
--   - testimonials: agent-owned testimonials (response when the
--     client submitted privately, OR manually entered by the agent
--     for a transaction that closed before this feature shipped)
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
      create table if not exists public.review_requests (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid null,
        transaction_id uuid null,
        -- Hash of the random token sent in the request URL. Raw
        -- token only ever leaves the server in the email/SMS;
        -- comparison hashes the inbound token before lookup.
        token_hash text not null unique,
        -- Optional public-facing destination for "leave a Google
        -- review" — agent sets this once in Settings.
        google_review_url text null,
        sent_at timestamptz not null default now(),
        expires_at timestamptz not null,
        responded_at timestamptz null,
        clicked_google_at timestamptz null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
    execute $sql$
      create table if not exists public.testimonials (
        id uuid primary key default gen_random_uuid(),
        agent_id uuid not null references public.agents(id) on delete cascade,
        contact_id uuid null,
        transaction_id uuid null,
        -- Optional pointer back to the request (null when manually entered)
        request_id uuid null references public.review_requests(id) on delete set null,
        rating int null check (rating between 1 and 5),
        body text not null default '',
        author_name text null,
        author_title text null,
        is_published boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  elsif v_agent_type in ('bigint', 'int8') then
    execute $sql$
      create table if not exists public.review_requests (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid null,
        transaction_id uuid null,
        token_hash text not null unique,
        google_review_url text null,
        sent_at timestamptz not null default now(),
        expires_at timestamptz not null,
        responded_at timestamptz null,
        clicked_google_at timestamptz null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
    execute $sql$
      create table if not exists public.testimonials (
        id uuid primary key default gen_random_uuid(),
        agent_id bigint not null references public.agents(id) on delete cascade,
        contact_id uuid null,
        transaction_id uuid null,
        request_id uuid null references public.review_requests(id) on delete set null,
        rating int null check (rating between 1 and 5),
        body text not null default '',
        author_name text null,
        author_title text null,
        is_published boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;
  else
    raise exception 'Unsupported public.agents.id type: %', v_agent_type;
  end if;
end $$;

comment on table public.review_requests is
  'Outbound asks for client testimonials / Google reviews after a transaction closes. Tokenized public landing page; one request per (agent, contact) is enforced at the service layer.';

comment on table public.testimonials is
  'Stored testimonials the agent can later surface as marketing copy. is_published gates display on the agent''s profile / IDX site.';

-- ── triggers ────────────────────────────────────────────────────

create or replace function public.set_review_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists review_requests_set_updated_at on public.review_requests;
create trigger review_requests_set_updated_at
  before update on public.review_requests
  for each row execute procedure public.set_review_requests_updated_at();

create or replace function public.set_testimonials_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists testimonials_set_updated_at on public.testimonials;
create trigger testimonials_set_updated_at
  before update on public.testimonials
  for each row execute procedure public.set_testimonials_updated_at();

-- ── indexes ─────────────────────────────────────────────────────

create index if not exists idx_review_requests_agent_sent
  on public.review_requests (agent_id, sent_at desc);

create index if not exists idx_review_requests_pending
  on public.review_requests (expires_at)
  where responded_at is null;

create index if not exists idx_testimonials_agent_published
  on public.testimonials (agent_id, is_published, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────

alter table public.review_requests enable row level security;
alter table public.testimonials enable row level security;

drop policy if exists "review_requests_select_own" on public.review_requests;
create policy "review_requests_select_own"
  on public.review_requests
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = review_requests.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

-- Insert / update / delete on review_requests + testimonials goes
-- through the service-role server path (cron / accept handler / agent
-- actions), so no client-side write policies needed for MVP.

drop policy if exists "testimonials_select_own" on public.testimonials;
create policy "testimonials_select_own"
  on public.testimonials
  for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = testimonials.agent_id
        and agents.auth_user_id = auth.uid()
    )
  );

drop policy if exists "testimonials_select_published" on public.testimonials;
create policy "testimonials_select_published"
  on public.testimonials
  for select
  using (is_published = true);
