create table if not exists home_value_reports (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  lead_id text null,
  property_address text not null,
  estimate_value numeric not null,
  range_low numeric not null,
  range_high numeric not null,
  confidence text not null,
  report_json jsonb not null,
  pdf_url text null,
  emailed_at timestamptz null,
  created_at timestamptz not null default now()
);
