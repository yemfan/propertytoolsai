-- Growth engine: shareable results, referrals, attribution (mirror LeadSmart)

create table if not exists public.shareable_results (
  id uuid primary key default gen_random_uuid(),
  brand text not null default 'propertytools',
  tool_slug text not null,
  title text not null,
  summary text,
  result_json jsonb not null default '{}'::jsonb,
  ref_code text,
  view_count int not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists idx_shareable_results_brand_created
  on public.shareable_results(brand, created_at desc);

create table if not exists public.referral_codes (
  code text primary key,
  auth_user_id uuid,
  agent_id bigint,
  label text,
  signups_count int not null default 0,
  conversions_count int not null default 0,
  shares_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_referral_codes_agent on public.referral_codes(agent_id);
create index if not exists idx_referral_codes_user on public.referral_codes(auth_user_id);

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.referral_codes(code) on delete cascade,
  event_type text not null check (event_type in ('view','click','signup','conversion','share')),
  auth_user_id uuid,
  page_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_referral_events_code_created on public.referral_events(code, created_at desc);
create index if not exists idx_referral_events_type_created on public.referral_events(event_type, created_at desc);
