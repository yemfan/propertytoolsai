-- Buyer/Seller client portal: chat + saved homes (service-role API enforces access)

create table if not exists public.client_portal_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads(id) on delete cascade,
  sender_role text not null check (sender_role in ('client', 'agent')),
  sender_auth_user_id uuid,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_portal_messages_lead_created
  on public.client_portal_messages(lead_id, created_at asc);

comment on table public.client_portal_messages is 'Client ↔ agent thread; API verifies lead email matches authenticated user for client sends.';

create table if not exists public.client_saved_homes (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  lead_id bigint references public.leads(id) on delete set null,
  address text not null,
  ai_score int,
  insights jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_saved_homes_user on public.client_saved_homes(auth_user_id, updated_at desc);

comment on table public.client_saved_homes is 'Mobile client saved listings; scoped by Supabase auth user id.';

create table if not exists public.client_portal_documents (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.leads(id) on delete cascade,
  title text not null,
  doc_type text not null default 'file' check (doc_type in ('file', 'link', 'report')),
  url text,
  storage_path text,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_portal_documents_lead on public.client_portal_documents(lead_id, created_at desc);

comment on table public.client_portal_documents is 'Agent-published docs for a lead; optional URLs or storage paths.';
